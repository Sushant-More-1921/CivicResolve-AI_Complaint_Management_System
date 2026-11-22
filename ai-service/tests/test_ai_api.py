import base64
import json
import unittest
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.api.routes.media import _decode_image
from app.main import app
from app.services.gemini import GeminiError
from app.services.language import detect_language


client = TestClient(app)


class LanguageTests(unittest.TestCase):
    def test_detects_supported_languages(self):
        self.assertEqual(detect_language("The road has a pothole"), "en")
        self.assertEqual(detect_language("सड़क पर गड्ढा है"), "hi")
        self.assertEqual(detect_language("सड़क पर कचरा है"), "hi")
        self.assertEqual(detect_language("रस्त्यावर खड्डा आहे"), "mr")
        self.assertEqual(detect_language("रस्त्यावर मोठा खड्डा"), "mr")

    def test_explicit_language_takes_precedence(self):
        self.assertEqual(detect_language("नमस्कार", "mr"), "mr")

    @patch(
        "app.services.analysis.gemini_generate_text",
        return_value="There is a pothole on the road.",
    )
    @patch("app.services.analysis.classifier.predict")
    @patch("app.services.analysis.priority_predictor.predict")
    def test_marathi_text_is_translated_before_classification(
        self, priority_predict, category_predict, translate
    ):
        category_predict.return_value = {
            "category": "Road/Pothole",
            "confidence": 0.9,
            "top_predictions": [],
        }
        priority_predict.return_value = {
            "priority": "High",
            "confidence": 0.8,
            "severity_score": 0.75,
            "source": "ml_model",
        }
        from app.services.analysis import analyze_text

        result = analyze_text("रस्त्यावर खड्डा आहे", "mr")

        self.assertEqual(result["language"], "mr")
        self.assertEqual(result["normalized_text"], "There is a pothole on the road.")
        category_predict.assert_called_once_with("There is a pothole on the road.")
        translate.assert_called_once()


class ImageValidationTests(unittest.TestCase):
    def test_accepts_valid_png_and_rejects_mismatched_content_type(self):
        png = b"\x89PNG\r\n\x1a\n" + b"image-data"
        encoded = base64.b64encode(png).decode("ascii")

        image_bytes, mime = _decode_image(encoded, "image/png")
        self.assertEqual(mime, "image/png")
        self.assertEqual(image_bytes, png)

        with self.assertRaises(ValueError):
            _decode_image(encoded, "image/jpeg")

    def test_accepts_data_url(self):
        png = b"\x89PNG\r\n\x1a\n" + b"image-data"
        data_url = "data:image/png;base64," + base64.b64encode(png).decode("ascii")
        _, mime = _decode_image(data_url, None)
        self.assertEqual(mime, "image/png")


class ApiTests(unittest.TestCase):
    @patch("app.api.routes.analyze.analyze_text")
    def test_unified_analysis_response(self, analyze_text):
        analyze_text.return_value = {
            "complaint": "Garbage dump near school",
            "language": "en",
            "normalized_text": "Garbage dump near school",
            "category": "Garbage",
            "category_confidence": 0.92,
            "category_status": "confident",
            "manual_review": False,
            "top_predictions": [{"category": "Garbage", "probability": 0.92}],
            "priority": "High",
            "priority_confidence": 0.88,
            "severity_score": 0.81,
            "priority_source": "ml_model",
        }
        response = client.post(
            "/analyze",
            json={"text": "Garbage dump near school"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["category"], "Garbage")
        self.assertEqual(response.json()["priority"], "High")

    @patch("app.api.routes.analyze.analyze_text")
    def test_classify_alias_uses_unified_analysis(self, analyze_text):
        analyze_text.return_value = {
            "complaint": "Water leaking",
            "language": "en",
            "normalized_text": "Water leaking",
            "category": "Water",
            "category_confidence": 0.85,
            "category_status": "confident",
            "manual_review": False,
            "top_predictions": [{"category": "Water", "probability": 0.85}],
            "priority": "Medium",
            "priority_confidence": 0.75,
            "severity_score": 0.55,
            "priority_source": "ml_model",
        }
        response = client.post(
            "/classify",
            json={"text": "Water leaking"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["category"], "Water")

    @patch("app.api.routes.analyze.analyze_text")
    def test_hotspot_enrichment_returns_hotspot_key(
        self,
        analyze_text,
    ):
        analyze_text.return_value = {
            "complaint": "The road has a huge pothole",
            "language": "en",
            "normalized_text": "The road has a huge pothole",
            "category": "Road",
            "category_confidence": 0.95,
            "category_status": "confident",
            "manual_review": False,
            "top_predictions": [{"category": "Road", "probability": 0.95}],
            "priority": "High",
            "priority_confidence": 0.85,
            "severity_score": 0.8,
            "priority_source": "ml_model",
        }
        response = client.post(
            "/analyze",
            json={
                "text": "The road has a huge pothole",
                "latitude": 16.705,
                "longitude": 74.243,
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("hotspots", response.json())

    def test_unified_analysis_rejects_empty_payload(self):
        response = client.post("/analyze", json={"text": "   "})
        self.assertEqual(response.status_code, 400)

    def test_unified_analysis_rejects_unpaired_coordinates(self):
        response = client.post(
            "/analyze",
            json={"text": "The road is damaged", "latitude": 16.7},
        )
        self.assertEqual(response.status_code, 422)

    @patch("app.api.routes.media.gemini_analyze_image", return_value="A pothole is visible.")
    @patch("app.api.routes.analyze.analyze_text")
    def test_image_route_returns_analysis(self, analyze_text, _vision):
        analyze_text.return_value = {
            "category": "Road/Pothole",
            "language": "en",
            "normalized_text": "A pothole is visible.",
            "priority": "Medium",
        }
        png = b"\x89PNG\r\n\x1a\n" + b"image-data"
        response = client.post(
            "/image/analyze",
            json={
                "image_base64": base64.b64encode(png).decode("ascii"),
                "content_type": "image/png",
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["image_description"], "A pothole is visible.")

    @patch(
        "app.api.routes.media.gemini_analyze_image",
        side_effect=GeminiError("Gemini Vision API connection failed."),
    )
    def test_image_route_reports_unavailable_vision_model(self, _vision):
        png = b"\x89PNG\r\n\x1a\n" + b"image-data"
        response = client.post(
            "/image/analyze",
            json={"image_base64": base64.b64encode(png).decode("ascii")},
        )
        self.assertEqual(response.status_code, 503)

    @patch(
        "app.api.routes.media.transcribe_audio",
        return_value={"text": "पानी नहीं है", "language": "hi", "language_probability": 0.9},
    )
    @patch("app.api.routes.analyze.analyze_text")
    def test_voice_route_returns_transcript_and_analysis(self, analyze_text, _transcribe):
        analyze_text.return_value = {
            "category": "Water",
            "language": "hi",
            "normalized_text": "There is no water.",
            "priority": "High",
        }
        response = client.post(
            "/voice/transcribe",
            files={"audio": ("complaint.wav", b"audio-data", "audio/wav")},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["language"], "hi")
        self.assertEqual(response.json()["analysis"]["category"], "Water")

    @patch(
        "app.api.routes.media.transcribe_audio",
        side_effect=RuntimeError("Voice transcription is not installed."),
    )
    def test_voice_route_reports_missing_whisper(self, _transcribe):
        response = client.post(
            "/voice/transcribe",
            files={"audio": ("complaint.wav", b"audio-data", "audio/wav")},
        )
        self.assertEqual(response.status_code, 503)


if __name__ == "__main__":
    unittest.main()
