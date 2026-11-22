import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
import joblib

MODEL_DIR = Path(__file__).resolve().parents[2] / "models" / "priority_model"
MODEL_PATH = MODEL_DIR / "model.joblib"
METADATA_PATH = MODEL_DIR / "metadata.json"

class PriorityPredictor:
    """
    Singleton Complaint Priority Prediction Service.
    Loads calibrated ML model once at startup and evaluates civic complaints
    into 4 standardized priority tiers: Critical, High, Medium, Low.
    """

    def __init__(self):
        if not MODEL_PATH.is_file():
            raise FileNotFoundError(f"Priority model not found at {MODEL_PATH}")

        self.model = joblib.load(MODEL_PATH)
        self.model_version = "priority-v2.0.0"

        # Life-safety critical fail-safe patterns
        self.safety_critical_rules = [
            (r"\b(electrocution|electrocuted|electric shock)\b", "Electrocution / severe electric shock hazard"),
            (r"\b(live wire|hanging wire|sparking wire|wire sparking|transformer fire|high voltage)\b", "Exposed high voltage electrical wire or sparking transformer"),
            (r"\b(gas leak|lpg leak|gas cylinder|pipeline explosion|explosion)\b", "Combustible gas leak or explosion risk"),
            (r"\b(fire|blaze|burning building|transformer explosion)\b", "Active fire or combustion emergency"),
            (r"\b(building collaps|wall collaps|bridge collaps|structure collaps|roof collaps|flyover crack|sinkhole)\b", "Structural collapse or catastrophic ground cave-in"),
            (r"\b(open manhole|missing manhole|uncovered manhole|uncovered pit)\b", "Uncovered manhole / fatal fall hazard on roadway"),
            (r"\b(toxic leak|poisonous|chemical spill|biohazard)\b", "Toxic chemical emission or hazardous material spill"),
            (r"\b(people trapped|person trapped|fatal accident)\b", "Trapped citizens or life-threatening physical entrapment"),
        ]

        # Factor detection patterns for explanation generation
        self.factor_rules = [
            (r"\b(live wire|electrocution|sparking|electric shock|high voltage)\b", "Electrical safety hazard"),
            (r"\b(gas leak|fire|explosion|cylinder)\b", "Fire or explosion hazard"),
            (r"\b(collapse|sinkhole|open manhole|uncovered pit)\b", "Physical safety / structural risk"),
            (r"\b(water supply stopped|no water|pipeline burst|water cut)\b", "Severe drinking water outage"),
            (r"\b(contaminated water|dirty water|muddy water|cholera)\b", "Drinking water contamination hazard"),
            (r"\b(sewage overflow|raw sewage|sewage into home|sewer backup)\b", "Raw sewage flooding and hygiene risk"),
            (r"\b(dengue|malaria|mosquito|epidemic|disease)\b", "Public health and vector-borne epidemic risk"),
            (r"\b(huge pothole|deep crater|road blocked|fallen tree)\b", "Arterial road and transit disruption"),
            (r"\b(garbage overflow|dumpster|stench|uncollected)\b", "Sanitation and waste accumulation"),
            (r"\b(streetlight|dark street|fused bulb|pitch dark)\b", "Public street lighting deficiency"),
            (r"\b(low water pressure|meter leak|pipe leak)\b", "Utility plumbing maintenance"),
            (r"\b(pothole|broken road|speed breaker|paver block)\b", "Surface roadway maintenance"),
            (r"\b(street sweeping|dry leaves|curb|park cleaning|pruning|trimming)\b", "Routine civic maintenance and cleaning"),
            (r"\b(stray dog|animal control|inquiry|feedback|information)\b", "Routine public services / administrative query"),
        ]

    def _extract_factors(self, text: str) -> List[str]:
        text_lower = text.lower()
        factors = []
        for pattern, factor_name in self.factor_rules:
            if re.search(pattern, text_lower):
                if factor_name not in factors:
                    factors.append(factor_name)
        return factors

    def _check_safety_critical(self, text: str) -> Optional[str]:
        text_lower = text.lower()
        for pattern, reason in self.safety_critical_rules:
            if re.search(pattern, text_lower):
                return reason
        return None

    def _format_feature(self, text: str, category: Optional[str] = None) -> str:
        cleaned = text.strip()
        if category and category.strip() and category.strip().lower() not in ["civic services", "general"]:
            return f"Category: {category.strip()}. {cleaned}"
        return cleaned

    def predict(
        self,
        text: str,
        category: Optional[str] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        similarity_count: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Predicts complaint priority with confidence, severity score, and explanation.
        """
        if not text or not str(text).strip():
            raise ValueError("Complaint text cannot be empty.")

        cleaned_text = str(text).strip()
        timestamp = datetime.now(timezone.utc).isoformat()

        # Step 1: Check Deterministic Life-Safety Override
        safety_reason = self._check_safety_critical(cleaned_text)

        # Step 2: ML Model Feature Preparation and Probability Scoring
        feature_text = self._format_feature(cleaned_text, category)
        try:
            probabilities = self.model.predict_proba([feature_text])[0]
            classes = list(self.model.classes_)
            prob_map = {cls: round(float(prob), 4) for cls, prob in zip(classes, probabilities)}
            ml_priority = self.model.predict([feature_text])[0]
            ml_confidence = prob_map.get(ml_priority, 0.95)
        except Exception as e:
            # Fallback if prediction fails
            ml_priority = "Medium"
            ml_confidence = 0.50
            prob_map = {"Critical": 0.05, "High": 0.20, "Medium": 0.50, "Low": 0.25}

        # Step 3: Determine Final Priority and Source
        if safety_reason:
            final_priority = "Critical"
            source = "safety_override"
            confidence = max(ml_confidence, 0.98)
            contributing_factors = [safety_reason]
            explanation = f"Critical priority assigned due to immediate life-safety hazard: {safety_reason}."
        else:
            final_priority = ml_priority
            source = "ml_model"
            confidence = ml_confidence
            extracted = self._extract_factors(cleaned_text)

            # Location/density booster if similarity_count or hotspot provided
            if similarity_count and similarity_count >= 5 and final_priority in ["Medium", "Low"]:
                final_priority = "High"
                source = "density_escalation"
                extracted.append(f"High local complaint density ({similarity_count}+ similar reports)")

            contributing_factors = extracted if extracted else [f"Classified by AI model based on civic impact indicators"]

            if final_priority == "Critical":
                explanation = f"Critical priority: Immediate hazard threatening public safety ({', '.join(contributing_factors[:2])})."
            elif final_priority == "High":
                explanation = f"High priority: Urgent civic hazard requiring rapid response ({', '.join(contributing_factors[:2])})."
            elif final_priority == "Medium":
                explanation = f"Medium priority: Standard operational repair or maintenance issue ({', '.join(contributing_factors[:2])})."
            else:
                explanation = f"Low priority: Routine civic service request or non-urgent maintenance ({', '.join(contributing_factors[:2])})."

        # Step 4: Map Severity Score
        severity_map = {
            "Critical": 0.95,
            "High": 0.75,
            "Medium": 0.50,
            "Low": 0.25
        }
        severity_score = severity_map.get(final_priority, 0.50)

        # Step 5: Normalize Priority String to Standard Format
        normalized_priority = final_priority.capitalize()  # "Critical", "High", "Medium", "Low"

        return {
            "priority": normalized_priority,
            "confidence": round(float(confidence), 4),
            "severity_score": severity_score,
            "source": source,
            "model_version": self.model_version,
            "timestamp": timestamp,
            "explanation": explanation,
            "contributing_factors": contributing_factors,
            "probabilities": prob_map
        }

    def batch_predict(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        results = []
        for item in items:
            text = item.get("text", "")
            cat = item.get("category")
            lat = item.get("latitude")
            lon = item.get("longitude")
            sim = item.get("similarity_count")
            try:
                res = self.predict(text=text, category=cat, latitude=lat, longitude=lon, similarity_count=sim)
                results.append({"status": "success", "result": res})
            except Exception as ex:
                results.append({"status": "error", "error": str(ex)})
        return results

# Singleton instance
priority_predictor = PriorityPredictor()
