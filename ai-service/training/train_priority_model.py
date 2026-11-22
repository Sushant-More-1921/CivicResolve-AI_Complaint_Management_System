import json
import os
from datetime import datetime, timezone
from pathlib import Path
import joblib
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.svm import LinearSVC

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_PATH = BASE_DIR / "data" / "priority_complaints.csv"
MODEL_DIR = BASE_DIR / "models" / "priority_model"
MODEL_PATH = MODEL_DIR / "model.joblib"
METADATA_PATH = MODEL_DIR / "metadata.json"

def prepare_feature_text(row):
    cat = str(row.get("category", "")).strip()
    txt = str(row["text"]).strip()
    if cat and cat != "Civic Services":
        return f"Category: {cat}. {txt}"
    return txt

def train_priority_model():
    print(f"Loading priority dataset from {DATA_PATH}...")
    df = pd.read_csv(DATA_PATH).dropna(subset=["text", "priority"])
    df["feature_text"] = df.apply(prepare_feature_text, axis=1)

    print("Dataset shape:", df.shape)
    print("\nClass distribution:")
    print(df["priority"].value_counts())

    X = df["feature_text"]
    y = df["priority"]

    # Stratified 80/20 train/test split to guarantee identical class ratios
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    print(f"\nTrain set size: {len(X_train)} | Test set size: {len(X_test)}")

    # High performance n-gram TF-IDF feature extractor
    vectorizer = TfidfVectorizer(
        lowercase=True,
        ngram_range=(1, 2),
        min_df=2,
        max_df=0.95,
        sublinear_tf=True,
        strip_accents="unicode"
    )

    # Class-balanced Linear Support Vector Classifier with Platt Scaling calibration
    base_clf = LinearSVC(
        C=1.5,
        class_weight="balanced",
        random_state=42,
        max_iter=3000
    )

    calibrated_clf = CalibratedClassifierCV(
        estimator=base_clf,
        method="sigmoid",
        cv=3
    )

    pipeline = Pipeline([
        ("tfidf", vectorizer),
        ("clf", calibrated_clf)
    ])

    print("\nRunning 5-fold Stratified Cross-Validation on training set...")
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_scores = cross_val_score(pipeline, X_train, y_train, cv=cv, scoring="f1_macro", n_jobs=-1)
    print(f"5-Fold CV Macro F1: {cv_scores.mean():.4f} (+/- {cv_scores.std():.4f})")

    print("\nFitting full training pipeline...")
    pipeline.fit(X_train, y_train)

    print("\nEvaluating on held-out test set...")
    y_pred = pipeline.predict(X_test)

    acc = accuracy_score(y_test, y_pred)
    macro_f1 = f1_score(y_test, y_pred, average="macro")
    weighted_f1 = f1_score(y_test, y_pred, average="weighted")
    report = classification_report(y_test, y_pred, output_dict=True, zero_division=0)
    cm = confusion_matrix(y_test, y_pred, labels=["Critical", "High", "Medium", "Low"])

    print("=" * 60)
    print("TEST SET EVALUATION RESULTS")
    print("=" * 60)
    print(f"Accuracy:         {acc:.4f} ({acc * 100:.2f}%)")
    print(f"Macro F1-Score:   {macro_f1:.4f}")
    print(f"Weighted F1:      {weighted_f1:.4f}")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, zero_division=0))
    print("\nConfusion Matrix (Rows: True, Cols: Pred [Critical, High, Medium, Low]):")
    print(cm)

    # Save model and metadata
    os.makedirs(MODEL_DIR, exist_ok=True)
    joblib.dump(pipeline, MODEL_PATH)
    print(f"\nModel pipeline saved to: {MODEL_PATH}")

    metadata = {
        "model_version": "priority-v2.0.0",
        "algorithm": "LinearSVC (C=1.5, class_weight='balanced') + CalibratedClassifierCV(cv=3, sigmoid)",
        "feature_extractor": "TfidfVectorizer(ngram_range=(1,2), sublinear_tf=True)",
        "training_date": datetime.now(timezone.utc).isoformat(),
        "dataset_size": len(df),
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "classes": list(pipeline.classes_),
        "metrics": {
            "accuracy": round(float(acc), 4),
            "macro_f1": round(float(macro_f1), 4),
            "weighted_f1": round(float(weighted_f1), 4),
            "cv_macro_f1_mean": round(float(cv_scores.mean()), 4),
            "cv_macro_f1_std": round(float(cv_scores.std()), 4),
            "classification_report": report,
            "confusion_matrix": cm.tolist()
        }
    }

    with open(METADATA_PATH, "w") as f:
        json.dump(metadata, f, indent=2)
    print(f"Model metadata and metrics saved to: {METADATA_PATH}")

    # Benchmark typical cases
    test_cases = [
        ("High voltage live electric wire broken and hanging on wet road, sparks flying", "Electricity"),
        ("Underground commercial gas pipeline leak near hospital, strong gas smell", "Public Safety"),
        ("Dilapidated building boundary wall collapsed onto pedestrian street", "Infrastructure"),
        ("Drinking water supply completely stopped for 4 days in residential area", "Water"),
        ("Raw sewage overflowing directly into ground floor houses since morning", "Drainage"),
        ("Severe dengue outbreak with multiple hospitalized residents due to choked drain", "Public Health"),
        ("Municipal garbage dumpster overflowing on street corner, bad stench", "Garbage"),
        ("Streetlight fused and not working on lane 2, dark area at night", "Streetlight"),
        ("Moderate pothole on colony lane making bike riding bumpy", "Road/Pothole"),
        ("Street sweeping required along sidewalk, dry leaves accumulated", "Sanitation"),
        ("Request for trimming overgrown tree branches touching private compound wall", "Civic Services"),
        ("Inquiry regarding municipal property tax payment dates", "Civic Services"),
    ]

    print("\n" + "=" * 60)
    print("VERIFICATION OF TYPICAL CIVIC SCENARIOS")
    print("=" * 60)
    for text, cat in test_cases:
        feat = f"Category: {cat}. {text}"
        pred = pipeline.predict([feat])[0]
        probs = pipeline.predict_proba([feat])[0]
        prob_dict = dict(zip(pipeline.classes_, probs))
        print(f"[{cat}] {text}")
        print(f"  -> Predicted Priority: {pred} (Confidence: {prob_dict[pred]:.4f})\n")

if __name__ == "__main__":
    train_priority_model()
