"""Comprehensive 12-scenario test suite for CivicResolve image validation.

Runs against REAL held-out test/ photographs (for civic/unrelated/clean categories)
and explicitly isolated synthetic_samples/ fixtures (ONLY for quality/corruption traps),
and saves detailed test output to `ai-service/evaluation/scenario_test_results.json`.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from app.services.image_validator import ImageValidatorService

DATASET_ROOT = BASE_DIR / "datasets" / "image_validation"
SYNTHETIC_DIR = DATASET_ROOT / "synthetic_samples"
EVAL_DIR = BASE_DIR / "evaluation"


def _first_real_test_image(cls: str, index: int = 0) -> Path:
    test_dir = DATASET_ROOT / cls / "test"
    if not test_dir.is_dir():
        raise FileNotFoundError(f"Missing real test directory: {test_dir}")
    files = sorted(p for p in test_dir.iterdir() if p.is_file() and p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"})
    if not files:
        raise FileNotFoundError(f"No real held-out test images under {test_dir}")
    return files[min(index, len(files) - 1)]


def _find_unrelated_by_prefix(prefixes: tuple[str, ...], fallback_idx: int = 0) -> Path:
    test_dir = DATASET_ROOT / "unrelated" / "test"
    files = sorted(p for p in test_dir.iterdir() if p.is_file())
    for p in files:
        low = p.name.lower()
        if any(pref in low for pref in prefixes):
            return p
    return files[min(fallback_idx, len(files) - 1)]


def run_all_12_scenarios() -> dict:
    service = ImageValidatorService()

    garbage_img = _first_real_test_image("garbage", 0)
    drainage_img = _first_real_test_image("drainage", 0)
    water_img = _first_real_test_image("water_pollution", 0)
    pothole_img = _first_real_test_image("road_damage", 0)
    sanitation_img = _first_real_test_image("sanitation", 0)

    clean_road_img = _find_unrelated_by_prefix(("normal", "clean", "street", "road"), 0)
    selfie_or_unrelated_img = _find_unrelated_by_prefix(("selfie", "portrait", "person", "park"), 1)
    screenshot_fixture = SYNTHETIC_DIR / "adversarial_mobile_ui_mockup.png"
    blurred_fixture = SYNTHETIC_DIR / "quality_severely_blurred.jpg"
    dark_fixture = SYNTHETIC_DIR / "quality_extremely_dark.jpg"
    corrupted_fixture = SYNTHETIC_DIR / "corrupted_evidence.jpg"

    # Compute hash of garbage_img first to test duplicate detection cleanly
    first_res = service.validate_bytes(
        garbage_img.read_bytes(),
        category="Waste & Garbage",
        description="Large pile of garbage dumped beside residential apartment street.",
        language="en",
    )
    existing_hash = first_res["perceptual_hash"]

    scenarios = [
        {
            "id": 1,
            "name": "Matching garbage image + Garbage category + description",
            "image": garbage_img,
            "is_synthetic_fixture": False,
            "category": "Waste & Garbage",
            "description": "Large pile of uncollected plastic garbage dumped beside residential street.",
            "language": "en",
            "existing_hashes": [],
            "allowed_statuses": {"VALID"},
        },
        {
            "id": 2,
            "name": "Matching pothole image + Road category + description",
            "image": pothole_img,
            "is_synthetic_fixture": False,
            "category": "Potholes & Roads",
            "description": "Deep broken asphalt pothole causing dangerous traffic slowdown on main road.",
            "language": "en",
            "existing_hashes": [],
            "allowed_statuses": {"VALID"},
        },
        {
            "id": 3,
            "name": "Matching drainage image + Drainage category + description",
            "image": drainage_img,
            "is_synthetic_fixture": False,
            "category": "Drainage",
            "description": "Blocked street storm drain overflowing dirty sewage water onto road.",
            "language": "en",
            "existing_hashes": [],
            "allowed_statuses": {"VALID", "NEEDS_REVIEW"},
        },
        {
            "id": 4,
            "name": "Matching water pollution image + Water Supply category + description",
            "image": water_img,
            "is_synthetic_fixture": False,
            "category": "Water Supply",
            "description": "Contaminated river water polluted with floating garbage and waste.",
            "language": "en",
            "existing_hashes": [],
            "allowed_statuses": {"VALID", "NEEDS_REVIEW"},
        },
        {
            "id": 5,
            "name": "Matching sanitation image + Sanitation category + multilingual Hindi description",
            "image": sanitation_img,
            "is_synthetic_fixture": False,
            "category": "Sanitation",
            "description": "सार्वजनिक शौचालय में भारी गंदगी और कचरा फैला हुआ है।",
            "language": "hi",
            "existing_hashes": [],
            "allowed_statuses": {"VALID", "NEEDS_REVIEW"},
        },
        {
            "id": 6,
            "name": "Category mismatch: Garbage image uploaded under Road Damage / Potholes",
            "image": garbage_img,
            "is_synthetic_fixture": False,
            "category": "Potholes & Roads",
            "description": "Deep pothole cracked open in middle of highway asphalt.",
            "language": "en",
            "existing_hashes": [],
            "allowed_statuses": {"INVALID", "NEEDS_REVIEW"},
        },
        {
            "id": 7,
            "name": "Unrelated photo / selfie or clean park uploaded as Garbage complaint",
            "image": selfie_or_unrelated_img,
            "is_synthetic_fixture": False,
            "category": "Waste & Garbage",
            "description": "Huge garbage dump overflowing outside residential gate.",
            "language": "en",
            "existing_hashes": [],
            "allowed_statuses": {"INVALID", "NEEDS_REVIEW"},
        },
        {
            "id": 8,
            "name": "Clean normal road claiming broken pothole (description contradiction)",
            "image": clean_road_img,
            "is_synthetic_fixture": False,
            "category": "Potholes & Roads",
            "description": "Massive broken pothole and sewage water flooding street.",
            "language": "en",
            "existing_hashes": [],
            "allowed_statuses": {"INVALID", "NEEDS_REVIEW"},
        },
        {
            "id": 9,
            "name": "Severely blurred image quality rejection (isolated synthetic fixture)",
            "image": blurred_fixture,
            "is_synthetic_fixture": True,
            "category": "Waste & Garbage",
            "description": "Garbage pile near street corner.",
            "language": "en",
            "existing_hashes": [],
            "allowed_statuses": {"INVALID"},
        },
        {
            "id": 10,
            "name": "Extremely dark image quality rejection (isolated synthetic fixture)",
            "image": dark_fixture,
            "is_synthetic_fixture": True,
            "category": "Drainage",
            "description": "Open drain overflowing near colony.",
            "language": "en",
            "existing_hashes": [],
            "allowed_statuses": {"INVALID"},
        },
        {
            "id": 11,
            "name": "Corrupted / unreadable image bytes (isolated synthetic fixture)",
            "image": corrupted_fixture,
            "is_synthetic_fixture": True,
            "category": "Potholes & Roads",
            "description": "Road damaged by heavy rain.",
            "language": "en",
            "existing_hashes": [],
            "allowed_statuses": {"INVALID"},
        },
        {
            "id": 12,
            "name": "Mobile UI screenshot trap & perceptual duplicate detection",
            "image": screenshot_fixture,
            "is_synthetic_fixture": True,
            "category": "Waste & Garbage",
            "description": "Garbage overflowing near dustbin.",
            "language": "en",
            "existing_hashes": [],
            "allowed_statuses": {"INVALID"},
        },
    ]

    results = []
    passed = 0
    for sc in scenarios:
        res = service.validate_bytes(
            sc["image"].read_bytes(),
            category=sc["category"],
            description=sc["description"],
            language=sc["language"],
            existing_hashes=sc["existing_hashes"],
        )
        ok = res["status"] in sc["allowed_statuses"]
        if ok:
            passed += 1
        entry = {
            "id": sc["id"],
            "name": sc["name"],
            "image": sc["image"].name,
            "is_synthetic_fixture": sc["is_synthetic_fixture"],
            "allowed_statuses": sorted(sc["allowed_statuses"]),
            "actual_status": res["status"],
            "passed": ok,
            "result": res,
        }
        results.append(entry)
        tag = "PASS" if ok else "FAIL"
        print(
            f"[{tag}] #{sc['id']:02d} {sc['name']} -> {res['status']} "
            f"(pred={res['predicted_category']}, conf={res['category_confidence']}, "
            f"desc_score={res['description_match_score']})",
            flush=True,
        )

    # Explicit duplicate detection verification on real garbage photo
    dup_res = service.validate_bytes(
        garbage_img.read_bytes(),
        category="Waste & Garbage",
        description="Large pile of uncollected plastic garbage dumped beside residential street.",
        language="en",
        existing_hashes=[existing_hash] if existing_hash else [],
    )
    dup_ok = bool(dup_res["duplicate_detected"]) and dup_res["status"] == "NEEDS_REVIEW"
    print(f"[{'PASS' if dup_ok else 'FAIL'}] Duplicate hash check -> status={dup_res['status']}, duplicate_detected={dup_res['duplicate_detected']}", flush=True)

    summary = {
        "scenarios_passed": passed,
        "scenarios_total": len(scenarios),
        "duplicate_detection_passed": dup_ok,
        "all_passed": (passed == len(scenarios)) and dup_ok,
        "results": results,
        "duplicate_check_result": dup_res,
    }
    EVAL_DIR.mkdir(parents=True, exist_ok=True)
    (EVAL_DIR / "scenario_test_results.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return summary


if __name__ == "__main__":
    summary = run_all_12_scenarios()
    if not summary["all_passed"]:
        sys.exit(1)

