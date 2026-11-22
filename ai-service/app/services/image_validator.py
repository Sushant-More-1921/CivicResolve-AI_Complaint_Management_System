"""AI Evidence Image Validation Service for CivicResolve.

Combines deterministic computer-vision quality checks, perceptual dHash duplicate
screening, a trained CLIP-embedding neural classifier head, and multimodal CLIP
image-text contrastive alignment.
"""

from __future__ import annotations

import json
import logging
import os
import re
from functools import lru_cache
from pathlib import Path
from typing import Iterable

import numpy as np
import torch
import torch.nn as nn

from app.services.image_quality import (
    assess_image_quality,
    compute_dhash,
    decode_pil_rgb,
    detect_mime_from_bytes,
    hamming_distance,
)
from app.services.language import detect_language
from app.services.verifier import normalize_category_name

logger = logging.getLogger("civicresolve.ai.image_validator")

BASE_DIR = Path(__file__).resolve().parents[2]
MODEL_DIR = BASE_DIR / "models" / "image_validator"
MODEL_WEIGHTS_PATH = MODEL_DIR / "classifier_head.pt"
MODEL_META_PATH = MODEL_DIR / "model_metadata.json"
DEFAULT_CLIP_BACKBONE_DIR = BASE_DIR / "models" / "clip_backbone"

VISUAL_CLASSES = [
    "garbage",
    "drainage",
    "water_pollution",
    "road_damage",
    "sanitation",
    "unrelated",
]

CANONICAL_TO_VISUAL = {
    "Waste & Garbage": "garbage",
    "Garbage & Waste": "garbage",
    "Solid Waste": "garbage",
    "Roads": "road_damage",
    "Potholes & Roads": "road_damage",
    "Road Maintenance": "road_damage",
    "Drainage": "drainage",
    "Drainage & Sewerage": "drainage",
    "Water Supply": "water_pollution",
    "Water Pollution": "water_pollution",
    "Sanitation": "sanitation",
    "Public Hygiene": "sanitation",
    "Streetlights": "other_civic",
    "Electrical": "other_civic",
    "Other": "other_civic",
    "Other Civic Issues": "other_civic",
}

VISUAL_DISPLAY_NAMES = {
    "garbage": "Garbage & Waste",
    "drainage": "Drainage & Sewage",
    "water_pollution": "Water Pollution",
    "road_damage": "Road Damage & Potholes",
    "sanitation": "Sanitation & Public Hygiene",
    "unrelated": "Unrelated / Non-Civic Scene",
    "low_quality": "Unusable / Low Quality",
}

# Bilingual Hindi/Marathi -> English civic glossary for offline CLIP semantic alignment
_INDIC_TO_EN_CIVIC = {
    "कचरा": "garbage trash waste dump",
    "कूड़ा": "garbage trash pile",
    "गंदगी": "filth garbage unsanitary waste",
    "डस्टबिन": "overflowing dustbin trash bin",
    "खड्डा": "road pothole damaged asphalt",
    "खड्डे": "potholes damaged road",
    "गड्ढा": "road pothole cracked street",
    "गड्ढे": "potholes broken road",
    "रस्ता": "road street asphalt",
    "रस्त्यावर": "on the street road",
    "सड़क": "street road asphalt",
    "नाला": "blocked open drain sewage",
    "गटार": "blocked gutter drain sewage",
    "ड्रेनेज": "drainage sewage overflow",
    "सीवेज": "sewage wastewater drain",
    "सांडपाणी": "overflowing sewage dirty water",
    "पाणी": "water",
    "पानी": "water",
    "गंदा": "polluted dirty contaminated",
    "प्रदूषित": "polluted contaminated",
    "नदी": "river water body",
    "तलाव": "lake pond water",
    "शौचालय": "dirty public toilet sanitation",
    "स्वच्छता": "sanitation public hygiene",
    "ओवरफ्लो": "overflowing flooded",
    "तुंबलेला": "clogged blocked",
    "तुंबलेले": "blocked clogged",
    "पथदिवा": "broken streetlight electric pole",
    "स्ट्रीटलाइट": "broken streetlight",
    "खराब": "damaged broken",
    "फुटलेला": "broken damaged cracked",
    "टूटा": "broken damaged cracked",
}

# Contrastive negative anchors to detect clean roads, selfies, screenshots, or documents
_NEGATIVE_ANCHORS = [
    "a clean empty paved asphalt road without any potholes or garbage",
    "a neat clean green park garden with grass and trees and no trash",
    "a close-up personal selfie portrait photo of a smiling person or group indoors",
    "a mobile phone app screenshot, website page, or printed paper receipt invoice",
    "indoor bedroom, living room furniture, restaurant food dish, or pet animal",
]

_CIVIC_VISUAL_ANCHORS = {
    "garbage": "piles of plastic waste, trash bags, overflowing dustbin, or garbage dumped outdoors",
    "drainage": "blocked storm drain, clogged gutter, or overflowing sewage water on a street",
    "water_pollution": "polluted river, pond, or canal covered with floating garbage, scum, or effluent",
    "road_damage": "broken asphalt road with deep potholes, pavement cracks, or crumbled street surface",
    "sanitation": "filthy unsanitary public toilet, urine-stained wall, or unhygienic alley gutter",
}


class CLIPMLPClassifier(nn.Module):
    """Lightweight calibrated MLP head over frozen CLIP ViT-B/32 visual embeddings."""

    def __init__(self, input_dim: int = 512, hidden_dim: int = 256, num_classes: int = 6, dropout: float = 0.25):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.LayerNorm(hidden_dim),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.LayerNorm(hidden_dim // 2),
            nn.GELU(),
            nn.Dropout(dropout * 0.6),
            nn.Linear(hidden_dim // 2, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


def normalize_description_for_clip(description: str, language: str | None = None) -> str:
    """Produce English-friendly visual query text for CLIP, preserving English tokens and mapping Hindi/Marathi terms."""
    desc = (description or "").strip()
    if not desc:
        return ""
    try:
        lang = detect_language(desc, None if (not language or language == "auto") else language)
    except ValueError:
        lang = "en"

    if lang == "en" and not any(0x0900 <= ord(ch) <= 0x097F for ch in desc):
        return desc[:300]

    english_hints: list[str] = []
    tokens = re.findall(r"[\w\u0900-\u097f]+", desc)
    for tok in tokens:
        mapped = _INDIC_TO_EN_CIVIC.get(tok) or _INDIC_TO_EN_CIVIC.get(tok.lower())
        if mapped:
            english_hints.append(mapped)
        elif tok.isascii() and len(tok) > 1:
            english_hints.append(tok)

    if english_hints:
        return ("photo showing " + " ".join(dict.fromkeys(english_hints)))[:300]
    return desc[:300]


def map_category_to_visual(category: str | None) -> str | None:
    if not category or not category.strip():
        return None
    raw = category.strip()
    low = raw.lower()
    direct = {
        "garbage": "garbage",
        "waste": "garbage",
        "solid waste": "garbage",
        "waste & garbage": "garbage",
        "garbage & waste": "garbage",
        "drainage": "drainage",
        "sewage": "drainage",
        "drainage & sewerage": "drainage",
        "water_pollution": "water_pollution",
        "water pollution": "water_pollution",
        "water": "water_pollution",
        "water supply": "water_pollution",
        "road_damage": "road_damage",
        "potholes & roads": "road_damage",
        "roads": "road_damage",
        "road maintenance": "road_damage",
        "sanitation": "sanitation",
        "public hygiene": "sanitation",
        "streetlights": "other_civic",
        "electrical": "other_civic",
        "other": "other_civic",
        "other civic issues": "other_civic",
    }
    if low in direct:
        return direct[low]
    canonical = normalize_category_name(raw)
    if canonical and canonical in CANONICAL_TO_VISUAL:
        return CANONICAL_TO_VISUAL[canonical]
    return "other_civic"


class ImageValidatorService:
    """Singleton service executing real trained quality, category, and multimodal checks."""

    def __init__(self, clip_dir: Path | None = None, model_dir: Path | None = None):
        self.model_dir = model_dir or MODEL_DIR
        weights_path = self.model_dir / "classifier_head.pt"
        meta_path = self.model_dir / "model_metadata.json"
        if not weights_path.is_file() or not meta_path.is_file():
            raise FileNotFoundError(
                f"Trained image validation model not found in {self.model_dir}. "
                "Run ai-service/training/train_model.py first."
            )

        self.metadata = json.loads(meta_path.read_text(encoding="utf-8"))
        self.classes: list[str] = self.metadata.get("classes", VISUAL_CLASSES)
        self.model_version: str = self.metadata.get("model_version", "civic-imgval-v1.0")
        self.thresholds: dict = self.metadata.get("calibrated_thresholds", {})

        resolved_clip = clip_dir or Path(
            os.getenv("CIVIC_CLIP_DIR") or self.metadata.get("clip_backbone_path") or DEFAULT_CLIP_BACKBONE_DIR
        )
        if not resolved_clip.is_dir():
            resolved_clip = DEFAULT_CLIP_BACKBONE_DIR

        from transformers import CLIPModel, CLIPProcessor

        local_only = (resolved_clip / "pytorch_model.bin").is_file() or (resolved_clip / "model.safetensors").is_file()
        model_id_or_path = str(resolved_clip) if local_only else "openai/clip-vit-base-patch32"

        logger.info("Loading CLIP backbone from %s (local_only=%s)...", model_id_or_path, local_only)
        self.clip_model = CLIPModel.from_pretrained(model_id_or_path, local_files_only=local_only)
        self.clip_processor = CLIPProcessor.from_pretrained(model_id_or_path, local_files_only=local_only)
        self.clip_model.eval()

        ckpt = torch.load(weights_path, map_location="cpu", weights_only=True)
        self.classifier = CLIPMLPClassifier(
            input_dim=int(ckpt.get("input_dim", 512)),
            hidden_dim=int(ckpt.get("hidden_dim", 256)),
            num_classes=len(self.classes),
        )
        self.classifier.load_state_dict(ckpt["state_dict"])
        self.classifier.eval()

        # Precompute normalized text embeddings for fixed negative & visual anchors once at startup
        with torch.no_grad():
            self.negative_text_embs = self._encode_texts(_NEGATIVE_ANCHORS)
            self.civic_anchor_embs = {
                k: self._encode_texts([v])[0] for k, v in _CIVIC_VISUAL_ANCHORS.items()
            }
        logger.info("ImageValidatorService initialized (version=%s, classes=%s).", self.model_version, self.classes)

    def _encode_texts(self, texts: list[str]) -> torch.Tensor:
        inputs = self.clip_processor(text=texts, return_tensors="pt", padding=True, truncation=True, max_length=77)
        with torch.no_grad():
            feats = self.clip_model.get_text_features(**inputs)
            if not isinstance(feats, torch.Tensor):
                feats = feats.pooler_output
            feats = feats / feats.norm(dim=-1, keepdim=True).clamp(min=1e-8)
        return feats

    def encode_image(self, pil_img) -> torch.Tensor:
        inputs = self.clip_processor(images=pil_img, return_tensors="pt")
        with torch.no_grad():
            feats = self.clip_model.get_image_features(**inputs)
            if not isinstance(feats, torch.Tensor):
                feats = feats.pooler_output
            feats = feats / feats.norm(dim=-1, keepdim=True).clamp(min=1e-8)
        return feats[0]

    def _check_duplicate_dhash(
        self, dhash_val: int, existing_hashes: Iterable[str] | None, max_hamming: int = 5
    ) -> bool:
        if not existing_hashes:
            return False
        for h_str in existing_hashes:
            if not h_str:
                continue
            try:
                other = int(str(h_str).strip(), 16)
                if hamming_distance(dhash_val, other) <= max_hamming:
                    return True
            except ValueError:
                continue
        return False

    def validate_bytes(
        self,
        raw_bytes: bytes,
        category: str = "",
        description: str = "",
        language: str | None = "auto",
        declared_content_type: str | None = None,
        existing_hashes: Iterable[str] | None = None,
    ) -> dict:
        """Run full multi-stage validation on raw image bytes."""
        # Stage 0A: Size & format validation
        if not raw_bytes:
            return self._invalid_response("Uploaded image file is empty.", "low_quality")

        detected_mime = detect_mime_from_bytes(raw_bytes)
        if not detected_mime:
            return self._invalid_response(
                "Unsupported or invalid image format. Please upload a valid JPEG, PNG, or WebP photo.",
                "low_quality",
            )
        if declared_content_type and declared_content_type != detected_mime:
            # Allow common JPEG/PNG re-encodings only if bytes cleanly decode, otherwise catch mismatch
            pass

        pil_img, rgb_arr, decode_err = decode_pil_rgb(raw_bytes)
        if decode_err or pil_img is None or rgb_arr is None:
            return self._invalid_response(
                "Uploaded image appears corrupted or unreadable. Please capture a fresh photo.",
                "low_quality",
            )

        # Stage 0B: Objective quality checks
        quality_status, metrics, quality_reasons = assess_image_quality(rgb_arr)
        dhash_val = compute_dhash(pil_img)
        dhash_hex = f"{dhash_val:016x}"

        if quality_status == "low_quality":
            reason_map = {
                "low_resolution": "Image resolution is too low to verify details cleanly (minimum 160x160 required).",
                "extremely_dark": "Image is too dark to clearly see the reported civic issue.",
                "overexposed": "Image is overly bright or washed out to inspect the issue.",
                "low_visual_information": "Image lacks clear visual detail (blank or flat frame).",
                "severely_blurred": "Image is excessively blurry. Please upload a sharper, focused photo.",
            }
            detail = " ".join(reason_map.get(r, r) for r in quality_reasons)
            return {
                "status": "INVALID",
                "category_match": False,
                "description_match": False,
                "image_quality": "low_quality",
                "predicted_category": "low_quality",
                "category_confidence": 0.99,
                "description_match_score": 0.0,
                "reason": detail,
                "requires_manual_review": False,
                "duplicate_detected": False,
                "perceptual_hash": dhash_hex,
                "model_version": self.model_version,
                "quality_metrics": metrics,
            }

        # Stage 0C: Duplicate screening against prior submitted complaint hashes
        duplicate_detected = self._check_duplicate_dhash(dhash_val, existing_hashes)

        # Stage 1: Visual category classification via trained neural classifier
        img_emb = self.encode_image(pil_img)
        with torch.no_grad():
            logits = self.classifier(img_emb.unsqueeze(0))[0]
            probs = torch.softmax(logits, dim=-1).cpu().numpy()

        prob_map = {cls: float(probs[i]) for i, cls in enumerate(self.classes)}
        predicted_cls = max(prob_map, key=prob_map.get)
        predicted_conf = float(prob_map[predicted_cls])
        unrelated_prob = float(prob_map.get("unrelated", 0.0))

        # Stage 2: Contrastive multimodal description-to-image alignment
        with torch.no_grad():
            neg_sims = (self.negative_text_embs @ img_emb).cpu().numpy()
            max_neg_sim = float(np.max(neg_sims))

            norm_desc = normalize_description_for_clip(description, language=language)
            selected_visual = map_category_to_visual(category)

            if norm_desc:
                desc_emb = self._encode_texts([norm_desc, f"civic infrastructure problem: {norm_desc}"])
                raw_desc_sim = float(torch.max(desc_emb @ img_emb).item())
            elif selected_visual and selected_visual in self.civic_anchor_embs:
                raw_desc_sim = float((self.civic_anchor_embs[selected_visual] @ img_emb).item())
            else:
                raw_desc_sim = float(1.0 - unrelated_prob)

            # Calibrated 0..1 alignment score incorporating margin over non-civic/clean-scene negatives
            margin = raw_desc_sim - max_neg_sim
            # Map raw CLIP cosine ~[0.14, 0.34] and margin ~[-0.06, +0.10] into smooth [0, 1]
            sim_component = np.clip((raw_desc_sim - 0.16) / 0.16, 0.0, 1.0)
            margin_component = np.clip((margin + 0.04) / 0.12, 0.0, 1.0)
            description_match_score = round(float(0.60 * sim_component + 0.40 * margin_component), 4)

        # Calibrated thresholds learned on validation/ split
        t_unrelated = float(self.thresholds.get("unrelated_reject_prob", 0.56))
        t_cat_conf = float(self.thresholds.get("category_conf_min", 0.50))
        t_cat_review = float(self.thresholds.get("category_review_min", 0.32))
        t_desc_min = float(self.thresholds.get("desc_match_min", 0.42))
        t_clean_margin_reject = float(self.thresholds.get("clean_margin_reject", -0.025))

        # Reject strongly unrelated / clean-scene images immediately
        if predicted_cls == "unrelated" and unrelated_prob >= t_unrelated:
            return self._build_result(
                status="INVALID",
                category_match=False,
                description_match=False,
                predicted_category=predicted_cls,
                category_confidence=predicted_conf,
                description_match_score=description_match_score,
                reason="Uploaded image does not depict a municipal civic issue (appears unrelated, personal, clean scene, or screenshot).",
                requires_manual_review=False,
                duplicate_detected=duplicate_detected,
                dhash_hex=dhash_hex,
                metrics=metrics,
            )

        if norm_desc and (raw_desc_sim - max_neg_sim) < t_clean_margin_reject and unrelated_prob >= 0.35:
            return self._build_result(
                status="INVALID",
                category_match=False,
                description_match=False,
                predicted_category="unrelated",
                category_confidence=max(predicted_conf, unrelated_prob),
                description_match_score=description_match_score,
                reason="Uploaded photo appears to show a clean area or non-issue scene that contradicts the complaint description.",
                requires_manual_review=False,
                duplicate_detected=duplicate_detected,
                dhash_hex=dhash_hex,
                metrics=metrics,
            )

        # Evaluate category alignment
        if selected_visual is None or selected_visual == "other_civic":
            category_match = unrelated_prob < 0.45
        else:
            target_prob = float(prob_map.get(selected_visual, 0.0))
            # Related outdoor civic overlap tolerance (e.g. drainage vs water_pollution or garbage vs sanitation)
            if selected_visual == predicted_cls:
                category_match = predicted_conf >= t_cat_review
            elif target_prob >= 0.25:
                category_match = True
            else:
                category_match = False

            # Confident visual contradiction against selected category -> INVALID
            if (
                predicted_cls != selected_visual
                and predicted_cls != "unrelated"
                and predicted_conf >= max(t_cat_conf, 0.62)
                and target_prob < 0.18
            ):
                pred_label = VISUAL_DISPLAY_NAMES.get(predicted_cls, predicted_cls)
                return self._build_result(
                    status="INVALID",
                    category_match=False,
                    description_match=description_match_score >= t_desc_min,
                    predicted_category=predicted_cls,
                    category_confidence=predicted_conf,
                    description_match_score=description_match_score,
                    reason=f"Photo appears to show '{pred_label}' instead of the selected complaint category.",
                    requires_manual_review=False,
                    duplicate_detected=duplicate_detected,
                    dhash_hex=dhash_hex,
                    metrics=metrics,
                )

        description_match = (description_match_score >= t_desc_min) if norm_desc else True

        if duplicate_detected:
            return self._build_result(
                status="NEEDS_REVIEW",
                category_match=category_match,
                description_match=description_match,
                predicted_category=predicted_cls,
                category_confidence=predicted_conf,
                description_match_score=description_match_score,
                reason="Duplicate or nearly identical evidence image detected against an existing submission; flagged for officer review.",
                requires_manual_review=True,
                duplicate_detected=True,
                dhash_hex=dhash_hex,
                metrics=metrics,
            )

        if category_match and description_match and predicted_conf >= t_cat_conf:
            return self._build_result(
                status="VALID",
                category_match=True,
                description_match=True,
                predicted_category=predicted_cls,
                category_confidence=predicted_conf,
                description_match_score=description_match_score,
                reason="Image quality is clear and visual content aligns with category and description.",
                requires_manual_review=False,
                duplicate_detected=False,
                dhash_hex=dhash_hex,
                metrics=metrics,
            )

        if not category_match and not description_match and unrelated_prob >= 0.30:
            return self._build_result(
                status="INVALID",
                category_match=False,
                description_match=False,
                predicted_category=predicted_cls,
                category_confidence=predicted_conf,
                description_match_score=description_match_score,
                reason="Image does not visually match the selected civic issue or written description.",
                requires_manual_review=False,
                duplicate_detected=False,
                dhash_hex=dhash_hex,
                metrics=metrics,
            )

        return self._build_result(
            status="NEEDS_REVIEW",
            category_match=category_match,
            description_match=description_match,
            predicted_category=predicted_cls,
            category_confidence=predicted_conf,
            description_match_score=description_match_score,
            reason="Visual evidence is partially ambiguous or borderline; officer verification recommended.",
            requires_manual_review=True,
            duplicate_detected=False,
            dhash_hex=dhash_hex,
            metrics=metrics,
        )

    def _invalid_response(self, reason: str, predicted_category: str) -> dict:
        return {
            "status": "INVALID",
            "category_match": False,
            "description_match": False,
            "image_quality": "low_quality",
            "predicted_category": predicted_category,
            "category_confidence": 0.99,
            "description_match_score": 0.0,
            "reason": reason,
            "requires_manual_review": False,
            "duplicate_detected": False,
            "perceptual_hash": None,
            "model_version": self.model_version,
        }

    def _build_result(
        self,
        *,
        status: str,
        category_match: bool,
        description_match: bool,
        predicted_category: str,
        category_confidence: float,
        description_match_score: float,
        reason: str,
        requires_manual_review: bool,
        duplicate_detected: bool,
        dhash_hex: str,
        metrics: dict,
    ) -> dict:
        return {
            "status": status,
            "category_match": bool(category_match),
            "description_match": bool(description_match),
            "image_quality": "good",
            "predicted_category": predicted_category,
            "category_confidence": round(float(category_confidence), 4),
            "description_match_score": round(float(description_match_score), 4),
            "reason": reason,
            "requires_manual_review": bool(requires_manual_review),
            "duplicate_detected": bool(duplicate_detected),
            "perceptual_hash": dhash_hex,
            "model_version": self.model_version,
            "quality_metrics": metrics,
        }


@lru_cache(maxsize=1)
def get_image_validator_service() -> ImageValidatorService:
    """Singleton getter so CLIP + classifier weights load only once."""
    return ImageValidatorService()

