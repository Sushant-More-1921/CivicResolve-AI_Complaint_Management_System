"""Clean, quality-screen, and deduplicate staged civic evidence images before splitting.

Operates on `ai-service/datasets/_staged_validation_pool/staging_manifest.json`
produced by `prepare_dataset.py`, performing:
  1. Strict binary/PIL image verification and EXIF-aware RGB conversion.
  2. Minimum resolution check (rejecting tiny thumbnails < 160x160).
  3. Objective visual quality assessment (blur, dark, overexposed, flat/low-entropy),
     routing naturally degraded captures to `low_quality` cleanly.
  4. Global SHA-256 exact deduplication + 64-bit perceptual dHash deduplication
     (Hamming distance <= 4) across ALL classes prior to train/val/test splitting.

Outputs cleaned records into `ai-service/datasets/_cleaned_validation_pool/cleaned_manifest.json`.
"""

from __future__ import annotations

import hashlib
import json
import shutil
import sys
import time
from collections import Counter
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from app.services.image_quality import (
    assess_image_quality,
    compute_dhash,
    decode_pil_rgb,
    hamming_distance,
)

STAGED_DIR = BASE_DIR / "datasets" / "_staged_validation_pool"
CLEANED_DIR = BASE_DIR / "datasets" / "_cleaned_validation_pool"

MIN_WIDTH = 160
MIN_HEIGHT = 160
DHASH_MAX_HAMMING = 4


def clean_staged_dataset() -> dict:
    staging_manifest_path = STAGED_DIR / "staging_manifest.json"
    if not staging_manifest_path.is_file():
        raise FileNotFoundError(
            f"Staged manifest not found at {staging_manifest_path}. Run prepare_dataset.py first."
        )

    staged_records: list[dict] = json.loads(staging_manifest_path.read_text(encoding="utf-8"))
    if CLEANED_DIR.exists():
        shutil.rmtree(CLEANED_DIR)
    CLEANED_DIR.mkdir(parents=True, exist_ok=True)

    seen_sha256: set[str] = set()
    seen_dhashes: list[int] = []
    rejection_counts: Counter[str] = Counter()
    class_counts: Counter[str] = Counter()
    cleaned_records: list[dict] = []

    print(f"[clean] Inspecting {len(staged_records)} staged images...", flush=True)
    t0 = time.time()

    for idx, rec in enumerate(staged_records, start=1):
        src_path = BASE_DIR / rec["staged_relpath"]
        if not src_path.is_file():
            rejection_counts["missing_file"] += 1
            continue

        raw_bytes = src_path.read_bytes()
        sha = hashlib.sha256(raw_bytes).hexdigest()
        if sha in seen_sha256:
            rejection_counts["exact_duplicate"] += 1
            continue

        pil_img, rgb_arr, err = decode_pil_rgb(raw_bytes)
        if err or pil_img is None or rgb_arr is None:
            rejection_counts[err or "corrupted"] += 1
            continue

        quality_status, metrics, quality_reasons = assess_image_quality(
            rgb_arr, min_width=MIN_WIDTH, min_height=MIN_HEIGHT
        )
        if "low_resolution" in quality_reasons:
            rejection_counts["low_resolution"] += 1
            continue

        dhash_val = compute_dhash(pil_img)
        if any(hamming_distance(dhash_val, existing) <= DHASH_MAX_HAMMING for existing in seen_dhashes):
            rejection_counts["near_duplicate_dhash"] += 1
            continue

        low_q_reason = quality_reasons[0] if quality_status == "low_quality" else None
        target_class = "low_quality" if quality_status == "low_quality" else rec["class"]
        if low_q_reason:
            rejection_counts[f"routed_low_quality:{low_q_reason}"] += 1

        seen_sha256.add(sha)
        seen_dhashes.append(dhash_val)

        out_cls_dir = CLEANED_DIR / target_class
        out_cls_dir.mkdir(parents=True, exist_ok=True)
        out_name = f"{src_path.stem}.jpg"
        out_path = out_cls_dir / out_name
        pil_img.save(out_path, format="JPEG", quality=92, optimize=True)

        cleaned_records.append(
            {
                "id": f"img_{len(cleaned_records):05d}",
                "class": target_class,
                "original_class": rec["class"],
                "low_quality_reason": low_q_reason,
                "source_dataset": rec["source_dataset"],
                "source_group": rec.get("source_group") or f"{rec['source_dataset']}:{src_path.stem}",
                "license": rec.get("license", "verified_open"),
                "source_url": rec.get("source_url", ""),
                "sha256": sha,
                "dhash_hex": f"{dhash_val:016x}",
                "is_synthetic": False,
                "metrics": metrics,
                "cleaned_relpath": out_path.relative_to(BASE_DIR).as_posix(),
            }
        )
        class_counts[target_class] += 1

        if idx % 250 == 0:
            print(f"        -> processed {idx}/{len(staged_records)} ({len(cleaned_records)} kept)", flush=True)

    summary = {
        "total_staged": len(staged_records),
        "total_kept": len(cleaned_records),
        "elapsed_seconds": round(time.time() - t0, 2),
        "class_counts": dict(sorted(class_counts.items())),
        "rejections_and_routing": dict(sorted(rejection_counts.items())),
    }

    (CLEANED_DIR / "cleaned_manifest.json").write_text(
        json.dumps({"summary": summary, "records": cleaned_records}, indent=2),
        encoding="utf-8",
    )
    print(f"[clean] Done in {summary['elapsed_seconds']}s: kept {summary['total_kept']}/{summary['total_staged']}", flush=True)
    print(f"        class_counts={summary['class_counts']}", flush=True)
    print(f"        rejections={summary['rejections_and_routing']}", flush=True)
    return summary


if __name__ == "__main__":
    clean_staged_dataset()
