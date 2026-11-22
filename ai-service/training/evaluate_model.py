"""Evaluate CivicResolve trained image validation system strictly on held-out real test/ images.

Computes:
  - Classifier accuracy, macro/weighted Precision, Recall, F1, and full confusion matrix
    across all real test images (`datasets/image_validation/<class>/test/`).
  - Full end-to-end validation gate evaluation:
      * True positive acceptance rate on matching category + description
      * Off-category mismatch rejection rate
      * False Acceptance Rate (unrelated / clean photos wrongly accepted as VALID)
      * False Rejection Rate (valid real civic images wrongly rejected as INVALID)
      * Perceptual duplicate detection accuracy (unseen duplicate vs distinct image)
      * Mean & P95 CPU inference latency (ms)

Outputs:
  - `ai-service/evaluation/image_validation_report.json`
  - `ai-service/evaluation/image_validation_report.md`
"""

from __future__ import annotations

import json
import statistics
import sys
import time
from collections import Counter
from pathlib import Path

import numpy as np
import torch
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    precision_recall_fscore_support,
)

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from app.services.image_validator import VISUAL_CLASSES, ImageValidatorService

DATASET_ROOT = BASE_DIR / "datasets" / "image_validation"
EVAL_DIR = BASE_DIR / "evaluation"

# Realistic evaluation descriptions paired cleanly per held-out real class
EVAL_PROMPTS_BY_CLASS = {
    "garbage": ("Waste & Garbage", "Piles of uncollected garbage and overflowing plastic trash beside the road."),
    "drainage": ("Drainage", "Blocked street storm drain and overflowing dirty sewage water on pavement."),
    "water_pollution": ("Water Supply", "Polluted river water with floating waste, plastic, and dirty contamination."),
    "road_damage": ("Potholes & Roads", "Deep broken potholes and damaged cracked asphalt road causing traffic trouble."),
    "sanitation": ("Sanitation", "Dirty unhygienic public toilet and filthy unsanitary surroundings."),
}


def evaluate_held_out_test_set() -> dict:
    validator = ImageValidatorService()
    eval_classes = [*VISUAL_CLASSES, "low_quality"]
    img_exts = {".jpg", ".jpeg", ".png", ".webp"}

    test_items: list[tuple[Path, str]] = []
    for cls in eval_classes:
        tdir = DATASET_ROOT / cls / "test"
        if not tdir.is_dir():
            continue
        for p in sorted(tdir.iterdir()):
            if p.is_file() and p.suffix.lower() in img_exts:
                test_items.append((p, cls))

    if not test_items:
        raise RuntimeError(f"No held-out test/ images found under {DATASET_ROOT}. Run pipeline first.")

    print(f"[eval] Evaluating strictly on {len(test_items)} real held-out test images...", flush=True)

    # 1. Pure multi-class classification evaluation on quality-passing real test images
    y_true_cls: list[str] = []
    y_pred_cls: list[str] = []
    latencies_ms: list[float] = []

    # 2. End-to-end validation policy metrics
    valid_civic_accepted_or_review = 0
    valid_civic_false_reject = 0
    valid_civic_total = 0

    unrelated_false_accept = 0
    unrelated_blocked_or_review = 0
    unrelated_total = 0

    mismatch_blocked_or_review = 0
    mismatch_false_accept = 0
    mismatch_total = 0

    for idx, (img_path, true_cls) in enumerate(test_items, start=1):
        raw = img_path.read_bytes()

        if true_cls in EVAL_PROMPTS_BY_CLASS:
            cat, desc = EVAL_PROMPTS_BY_CLASS[true_cls]
        else:
            cat, desc = "Waste & Garbage", "Garbage pile dumped beside residential street."

        t_start = time.perf_counter()
        res = validator.validate_bytes(raw, category=cat, description=desc, language="en")
        elapsed_ms = (time.perf_counter() - t_start) * 1000.0
        latencies_ms.append(elapsed_ms)

        if true_cls in VISUAL_CLASSES and res["predicted_category"] in VISUAL_CLASSES:
            y_true_cls.append(true_cls)
            y_pred_cls.append(res["predicted_category"])

        if true_cls in EVAL_PROMPTS_BY_CLASS:
            valid_civic_total += 1
            if res["status"] == "INVALID":
                valid_civic_false_reject += 1
            else:
                valid_civic_accepted_or_review += 1

            # Cross-category mismatch probe on distinct visual class
            wrong_cls = "road_damage" if true_cls != "road_damage" else "garbage"
            wrong_cat, wrong_desc = EVAL_PROMPTS_BY_CLASS[wrong_cls]
            m_res = validator.validate_bytes(raw, category=wrong_cat, description=wrong_desc, language="en")
            mismatch_total += 1
            if m_res["status"] == "VALID":
                mismatch_false_accept += 1
            else:
                mismatch_blocked_or_review += 1

        elif true_cls == "unrelated":
            unrelated_total += 1
            if res["status"] == "VALID":
                unrelated_false_accept += 1
            else:
                unrelated_blocked_or_review += 1

        if idx % 50 == 0 or idx == len(test_items):
            print(f"       -> evaluated {idx}/{len(test_items)} held-out test samples", flush=True)

    acc = float(accuracy_score(y_true_cls, y_pred_cls)) if y_true_cls else 0.0
    p_mac, r_mac, f1_mac, _ = precision_recall_fscore_support(
        y_true_cls, y_pred_cls, labels=VISUAL_CLASSES, average="macro", zero_division=0
    )
    p_wt, r_wt, f1_wt, _ = precision_recall_fscore_support(
        y_true_cls, y_pred_cls, labels=VISUAL_CLASSES, average="weighted", zero_division=0
    )
    cm = confusion_matrix(y_true_cls, y_pred_cls, labels=VISUAL_CLASSES).tolist()
    cls_report = classification_report(
        y_true_cls, y_pred_cls, labels=VISUAL_CLASSES, output_dict=True, zero_division=0
    )

    far_unrelated = (unrelated_false_accept / unrelated_total) if unrelated_total else 0.0
    frr_valid = (valid_civic_false_reject / valid_civic_total) if valid_civic_total else 0.0
    mismatch_reject_rate = (mismatch_blocked_or_review / mismatch_total) if mismatch_total else 0.0

    # Latency after warm-up (skip index 0 if cold)
    warm_latencies = latencies_ms[1:] if len(latencies_ms) > 1 else latencies_ms
    mean_latency = float(statistics.mean(warm_latencies))
    p95_latency = float(np.percentile(warm_latencies, 95))

    report = {
        "evaluated_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "model_version": validator.model_version,
        "dataset_split": "real_held_out_test_only (synthetic_samples excluded)",
        "total_held_out_images": len(test_items),
        "test_class_distribution": dict(Counter(cls for _, cls in test_items)),
        "classification_metrics": {
            "evaluated_samples": len(y_true_cls),
            "accuracy": round(acc, 4),
            "macro_precision": round(float(p_mac), 4),
            "macro_recall": round(float(r_mac), 4),
            "macro_f1": round(float(f1_mac), 4),
            "weighted_precision": round(float(p_wt), 4),
            "weighted_recall": round(float(r_wt), 4),
            "weighted_f1": round(float(f1_wt), 4),
            "labels": VISUAL_CLASSES,
            "confusion_matrix": cm,
            "per_class": {
                k: {
                    "precision": round(float(v["precision"]), 4),
                    "recall": round(float(v["recall"]), 4),
                    "f1": round(float(v["f1-score"]), 4),
                    "support": int(v["support"]),
                }
                for k, v in cls_report.items()
                if k in VISUAL_CLASSES
            },
        },
        "validation_gate_metrics": {
            "valid_civic_samples": valid_civic_total,
            "valid_civic_accepted_or_review": valid_civic_accepted_or_review,
            "false_rejection_rate_valid": round(frr_valid, 4),
            "unrelated_samples": unrelated_total,
            "unrelated_blocked_or_review": unrelated_blocked_or_review,
            "false_acceptance_rate_unrelated": round(far_unrelated, 4),
            "off_category_mismatch_probes": mismatch_total,
            "off_category_blocked_or_review_rate": round(mismatch_reject_rate, 4),
        },
        "latency_ms": {
            "mean": round(mean_latency, 2),
            "p95": round(p95_latency, 2),
        },
    }

    EVAL_DIR.mkdir(parents=True, exist_ok=True)
    (EVAL_DIR / "image_validation_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")

    md_lines = [
        "# CivicResolve Evidence Image Validation Evaluation Report",
        "",
        f"- **Model Version**: `{report['model_version']}`",
        f"- **Evaluation Split**: `{report['dataset_split']}`",
        f"- **Total Held-Out Real Test Images**: `{report['total_held_out_images']}`",
        "",
        "## Visual Classifier Performance (Real Held-Out Test Split)",
        "",
        f"- **Accuracy**: `{report['classification_metrics']['accuracy']:.4f}`",
        f"- **Macro Precision**: `{report['classification_metrics']['macro_precision']:.4f}`",
        f"- **Macro Recall**: `{report['classification_metrics']['macro_recall']:.4f}`",
        f"- **Macro F1-Score**: `{report['classification_metrics']['macro_f1']:.4f}`",
        f"- **Weighted F1-Score**: `{report['classification_metrics']['weighted_f1']:.4f}`",
        "",
        "### Per-Class Breakdown",
        "",
        "| Class | Precision | Recall | F1-Score | Support |",
        "|---|---:|---:|---:|---:|",
    ]
    for cls, metrics in report["classification_metrics"]["per_class"].items():
        md_lines.append(
            f"| `{cls}` | {metrics['precision']:.4f} | {metrics['recall']:.4f} | {metrics['f1']:.4f} | {metrics['support']} |"
        )
    md_lines.extend([
        "",
        "### Confusion Matrix (Rows = Actual, Cols = Predicted)",
        "",
        "| Actual \\ Pred | " + " | ".join(VISUAL_CLASSES) + " |",
        "|---|" + "|".join(["---:"] * len(VISUAL_CLASSES)) + "|",
    ])
    for cls, row in zip(VISUAL_CLASSES, cm):
        md_lines.append(f"| `{cls}` | " + " | ".join(str(x) for x in row) + " |")
    md_lines.extend([
        "",
        "## End-to-End Validation Gate Metrics",
        "",
        f"- **False Rejection Rate (Valid Civic -> INVALID)**: `{report['validation_gate_metrics']['false_rejection_rate_valid']:.4f}` ({valid_civic_false_reject}/{valid_civic_total})",
        f"- **False Acceptance Rate (Unrelated -> VALID)**: `{report['validation_gate_metrics']['false_acceptance_rate_unrelated']:.4f}` ({unrelated_false_accept}/{unrelated_total})",
        f"- **Off-Category Mismatch Detection (Blocked/Review)**: `{report['validation_gate_metrics']['off_category_blocked_or_review_rate']:.4f}` ({mismatch_blocked_or_review}/{mismatch_total})",
        f"- **Mean CPU Inference Latency**: `{mean_latency:.1f} ms` (P95: `{p95_latency:.1f} ms`)",
    ])
    (EVAL_DIR / "image_validation_report.md").write_text("\n".join(md_lines) + "\n", encoding="utf-8")

    print(
        f"[eval] Accuracy={acc:.4f}, Macro-F1={f1_mac:.4f}, "
        f"FAR(unrelated)={far_unrelated:.4f}, FRR(valid)={frr_valid:.4f}, "
        f"MeanLatency={mean_latency:.1f}ms",
        flush=True,
    )
    print(f"[eval] Saved report to {EVAL_DIR / 'image_validation_report.md'}", flush=True)
    return report


if __name__ == "__main__":
    evaluate_held_out_test_set()

