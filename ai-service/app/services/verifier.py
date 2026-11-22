from pathlib import Path
import re
import joblib

MODEL_PATH = Path(__file__).resolve().parents[2] / "models" / "complaint_verifier" / "model.joblib"

# Canonical Category Definitions
CATEGORY_MAPPINGS = {
    # Keys from frontend / forms
    "waste": "Solid Waste / Garbage Disposal",
    "garbage": "Solid Waste / Garbage Disposal",
    "solid waste": "Solid Waste / Garbage Disposal",
    "solid waste / garbage disposal": "Solid Waste / Garbage Disposal",
    
    "roads": "Potholes & Road Maintenance",
    "road": "Potholes & Road Maintenance",
    "road/pothole": "Potholes & Road Maintenance",
    "potholes": "Potholes & Road Maintenance",
    "potholes & road maintenance": "Potholes & Road Maintenance",
    
    "water": "Water Supply & Leakage",
    "water supply": "Water Supply & Leakage",
    "water supply & leakage": "Water Supply & Leakage",
    
    "drainage": "Sewage & Drainage Overflow",
    "sewage": "Sewage & Drainage Overflow",
    "sewage & drainage": "Sewage & Drainage Overflow",
    "sewage & drainage overflow": "Sewage & Drainage Overflow",
    
    "streetlights": "Streetlight Malfunction",
    "streetlight": "Streetlight Malfunction",
    "street light": "Streetlight Malfunction",
    "streetlight malfunction": "Streetlight Malfunction",
    
    "other": "Other Civic Issue",
    "other civic issue": "Other Civic Issue",
    "pollution": "Other Civic Issue",
}

CATEGORY_TO_KEY = {
    "Solid Waste / Garbage Disposal": "waste",
    "Potholes & Road Maintenance": "roads",
    "Water Supply & Leakage": "water",
    "Sewage & Drainage Overflow": "drainage",
    "Streetlight Malfunction": "streetlights",
    "Other Civic Issue": "other",
}

SPAM_CATEGORY = "Irrelevant / Spam / Non-Civic"

def normalize_category_name(category: str | None) -> str | None:
    if not category:
        return None
    cleaned = category.strip().lower()
    return CATEGORY_MAPPINGS.get(cleaned, category.strip())

def detect_non_civic_reason(text: str) -> str | None:
    cleaned = text.strip()
    if not cleaned:
        return "Complaint description cannot be empty. Please enter your grievance details."
    
    if len(cleaned) < 10:
        return f"Description is too brief ({len(cleaned)} characters). Please enter at least 10 characters detailing the problem and location."
    
    # Check for excessive repeated characters like "aaaaaaa" or "1111111"
    if re.search(r'(.)\1{4,}', cleaned):
        return "Description contains repeated or meaningless characters. Please enter a valid civic grievance."
    
    # Check for text with no letters
    if not bool(re.search(r'[a-zA-Z\u0900-\u097F]', cleaned)):
        return "Description must contain readable words. Please describe the grievance clearly."

    # Specific check for test / trial entries
    test_match = re.search(
        r'\b(random\s*test|testing\s*purpose|sample\s*test|just\s*testing|test\s*entry|this\s*is\s*a\s*test|for\s*testing)\b',
        cleaned,
        re.IGNORECASE
    )
    if test_match:
        return f'Description appears to be a test entry ("{test_match.group(0)}"). Grievances can only be submitted for genuine civic issues (such as road potholes, garbage, water leaks, or streetlights).'

    if re.search(r'^\s*(test|testing|check|trial)\s*(\d+)?\s*$', cleaned, re.IGNORECASE):
        return "Description appears to be a test placeholder. Please describe an actual civic grievance to submit."

    # Specific check for personal introduction / identity
    name_match = re.search(
        r'\b(my\s*name\s*is|i\s*am\s*a\b|myself\b|call\s*me\b|मेरा\s*नाम|माझं\s*नाव|माझे\s*नाव|mera\s*naam)\b',
        cleaned,
        re.IGNORECASE
    )
    if name_match:
        return f'Description appears to be a personal introduction ("{name_match.group(0)}"). Civic complaints must describe a specific municipal issue and its location rather than personal information.'

    # Casual greeting / chit-chat
    greet_match = re.search(
        r'^\s*(hello|hi|hey|good\s*(morning|afternoon|evening)|namaste|नमस्ते|नमस्कार)\b',
        cleaned,
        re.IGNORECASE
    )
    if greet_match and len(cleaned.split()) <= 6:
        return f'Description contains only a greeting ("{greet_match.group(0)}"). Please describe the specific civic problem you need resolved.'

    return None


class ComplaintVerifierService:
    def __init__(self):
        if not MODEL_PATH.is_file():
            raise FileNotFoundError(f"Complaint verifier model not found at {MODEL_PATH}")
        self.model = joblib.load(MODEL_PATH)
        self.classes = list(self.model.classes_)

    def verify_description(
        self,
        description: str,
        selected_category: str | None = None,
        language: str = "auto",
    ) -> dict:
        desc = (description or "").strip()
        
        # 1. Structural, test, personal introduction, and greeting checks
        non_civic_reason = detect_non_civic_reason(desc)
        if non_civic_reason:
            return {
                "is_relevant": False,
                "predicted_category": None,
                "confidence": 0.0,
                "status": "invalid",
                "message": non_civic_reason,
                "suggested_category": None,
                "suggested_category_key": None,
            }

        # 2. Model Inference
        predicted_raw = self.model.predict([desc])[0]
        probabilities = self.model.predict_proba([desc])[0]
        prob_dict = dict(zip(self.classes, probabilities))
        confidence = round(float(prob_dict[predicted_raw]), 4)

        # 3. Handle Non-Civic / Spam predicted by ML model
        if predicted_raw == SPAM_CATEGORY or confidence < 0.35:
            return {
                "is_relevant": False,
                "predicted_category": None,
                "confidence": confidence,
                "status": "invalid",
                "message": "Description appears to be unrelated to municipal or civic services. Please describe an issue regarding garbage, potholes, water supply, sewage, or streetlights.",
                "suggested_category": None,
                "suggested_category_key": None,
            }

        predicted_category = predicted_raw
        normalized_selected = normalize_category_name(selected_category)
        suggested_key = CATEGORY_TO_KEY.get(predicted_category, "other")

        # 4. Compare with selected category
        if not normalized_selected:
            # User hasn't chosen a category yet
            return {
                "is_relevant": True,
                "predicted_category": predicted_category,
                "confidence": confidence,
                "status": "review_required",
                "message": f"Description matches '{predicted_category}'. Please select this category to proceed.",
                "suggested_category": predicted_category,
                "suggested_category_key": suggested_key,
            }

        if normalized_selected == predicted_category:
            return {
                "is_relevant": True,
                "predicted_category": predicted_category,
                "confidence": confidence,
                "status": "verified",
                "message": "Description matches the selected complaint category.",
                "suggested_category": None,
                "suggested_category_key": None,
            }

        # Allow "other" selection if user intentionally chooses it and confidence is moderate
        if normalized_selected == "Other Civic Issue" and confidence < 0.65:
            return {
                "is_relevant": True,
                "predicted_category": predicted_category,
                "confidence": confidence,
                "status": "verified",
                "message": "Description accepted under Other Civic Issue.",
                "suggested_category": None,
                "suggested_category_key": None,
            }

        # If high/medium confidence in a different civic category -> MISMATCH
        if confidence >= 0.50:
            return {
                "is_relevant": True,
                "predicted_category": predicted_category,
                "confidence": confidence,
                "status": "mismatch",
                "message": f"Description appears to be about '{predicted_category}' rather than '{selected_category}'. Please update your category or clarify your description.",
                "suggested_category": predicted_category,
                "suggested_category_key": suggested_key,
            }

        # Ambiguous / Low confidence case -> REVIEW_REQUIRED (Never reject genuine complaints)
        return {
            "is_relevant": True,
            "predicted_category": predicted_category,
            "confidence": confidence,
            "status": "review_required",
            "message": "Complaint description is ambiguous and will be reviewed by an officer upon submission.",
            "suggested_category": predicted_category,
            "suggested_category_key": suggested_key,
        }


# Singleton instance
complaint_verifier = ComplaintVerifierService()

