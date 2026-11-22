import sys
import joblib
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

MODEL_PATH = Path(__file__).resolve().parents[1] / "models" / "complaint_verifier" / "model.joblib"
model = joblib.load(MODEL_PATH)

test_cases = [
    # English
    ("Large open garbage pile rotting outside our building, stray animals spreading it", "Solid Waste / Garbage Disposal"),
    ("Severe water pipe burst on 4th street, clean drinking water wasted on road", "Water Supply & Leakage"),
    ("Open manhole gutter overflowing with stinking black sewage water", "Sewage & Drainage Overflow"),
    ("Deep pothole on highway caused a motorcycle accident yesterday", "Potholes & Road Maintenance"),
    ("Street light pole broken and dark at night, women feel unsafe", "Streetlight Malfunction"),
    ("Dead stray dog lying on roadside since two days", "Other Civic Issue"),
    # Hindi
    ("गली में कचरा जमा है और बहुत बदबू आ रही है", "Solid Waste / Garbage Disposal"),
    ("सड़क पर बड़ा गड्ढा है पानी भर गया है", "Potholes & Road Maintenance"),
    ("पीने का पानी नहीं आ रहा है दो दिन से", "Water Supply & Leakage"),
    ("गटर का गंदा पानी सड़क पर बह रहा है", "Sewage & Drainage Overflow"),
    ("स्ट्रीट लाइट बंद है रात को अंधेरा रहता है", "Streetlight Malfunction"),
    # Marathi
    ("रस्त्यावर कचरा साचला आहे दुर्गंधी पसरली आहे", "Solid Waste / Garbage Disposal"),
    ("रस्त्यावर मोठा खड्डा पडला आहे अपघात होत आहेत", "Potholes & Road Maintenance"),
    ("पाणी पुरवठा बंद आहे नळाला पाणी येत नाही", "Water Supply & Leakage"),
    ("गटार तुंबले आहे सांडपाणी रस्त्यावर येत आहे", "Sewage & Drainage Overflow"),
    ("गल्लीतील विजेचा खांब बंद आहे अंधार पडतो", "Streetlight Malfunction"),
    # Hinglish / Transliterated Marathi
    ("Road var khoop kachra ahe please pickup kara", "Solid Waste / Garbage Disposal"),
    ("Gutter overflow hot ahe stinking smell ahe", "Sewage & Drainage Overflow"),
    ("Potholes on road are dangerous for bikes", "Potholes & Road Maintenance"),
    ("Water leakage from main pipe near temple", "Water Supply & Leakage"),
    # Irrelevant / Spam / Gibberish / Non-civic
    ("asdkjasdklj 123456 !!!", "Irrelevant / Spam / Non-Civic"),
    ("I want to buy a new iPhone 16 Pro Max", "Irrelevant / Spam / Non-Civic"),
    ("Hello good morning how are you", "Irrelevant / Spam / Non-Civic"),
    ("Hi testing 123", "Irrelevant / Spam / Non-Civic"),
    ("Weather is very nice today enjoying tea", "Irrelevant / Spam / Non-Civic")
]

print("=" * 80)
print("EVALUATION: TESTING IMPROVED VERIFIER MODEL")
print("=" * 80)

correct = 0
for text, exp in test_cases:
    pred = model.predict([text])[0]
    probs = model.predict_proba([text])[0]
    conf = float(max(probs))
    is_correct = (pred == exp)
    if is_correct:
        correct += 1
    mark = "✓" if is_correct else "✗"
    print(f"[{mark}] Input: {text}")
    print(f"    Expected:  {exp}")
    print(f"    Predicted: {pred} (Confidence: {conf*100:.1f}%)\n")

print("=" * 80)
print(f"Summary: {correct}/{len(test_cases)} ({correct/len(test_cases)*100:.1f}%) test cases passed correctly!")
print("=" * 80)

