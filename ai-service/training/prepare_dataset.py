"""Stage and harmonize multi-source raw civic datasets into canonical visual classes.

Maps verified public datasets under `ai-service/datasets/raw_downloads/` into
`ai-service/datasets/_staged_validation_pool/<class>/` and emits
`staging_manifest.json` with source provenance, grouping IDs, and licenses.

Canonical visual classes staged here:
  - `garbage`
  - `drainage`
  - `water_pollution`
  - `road_damage`
  - `sanitation`
  - `unrelated`
(Real low-quality images, if naturally present, are routed by `clean_dataset.py`.)
"""

from __future__ import annotations

import json
import shutil
from collections import Counter
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
RAW_DIR = BASE_DIR / "datasets" / "raw_downloads"
STAGED_DIR = BASE_DIR / "datasets" / "_staged_validation_pool"
IMG_EXTS = {".jpg", ".jpeg", ".png", ".webp"}


def _roboflow_group_key(path: Path, dataset_tag: str) -> str:
    stem = path.stem
    if ".rf." in stem:
        stem = stem.split(".rf.")[0]
    return f"{dataset_tag}:{stem}"


def prepare_all_datasets(wasteseg_cap: int = 240) -> dict:
    if STAGED_DIR.exists():
        shutil.rmtree(STAGED_DIR)
    STAGED_DIR.mkdir(parents=True, exist_ok=True)

    records: list[dict] = []
    counts: Counter[str] = Counter()

    def _stage_file(
        src: Path,
        cls: str,
        dst_name: str,
        source_dataset: str,
        source_group: str,
        lic: str,
        source_url: str,
    ) -> None:
        cls_dir = STAGED_DIR / cls
        cls_dir.mkdir(parents=True, exist_ok=True)
        dst = cls_dir / dst_name
        shutil.copy2(src, dst)
        records.append(
            {
                "class": cls,
                "source_dataset": source_dataset,
                "source_group": source_group,
                "license": lic,
                "source_url": source_url,
                "staged_relpath": dst.relative_to(BASE_DIR).as_posix(),
            }
        )
        counts[cls] += 1

    # 1. Mendeley WasteSegCluster -> urban lake/water body plastic & waste pollution
    wsc_dir = RAW_DIR / "wastesegcluster" / "extracted"
    if wsc_dir.is_dir():
        wsc_imgs = sorted(p for p in wsc_dir.rglob("*") if p.is_file() and p.suffix.lower() in IMG_EXTS)
        step = max(1, len(wsc_imgs) // wasteseg_cap)
        selected_wsc = wsc_imgs[::step][:wasteseg_cap]
        for i, p in enumerate(selected_wsc):
            _stage_file(
                src=p,
                cls="water_pollution",
                dst_name=f"wsc_{i:04d}{p.suffix.lower()}",
                source_dataset="WasteSegCluster (Mendeley 3wnf3n242s)",
                source_group=_roboflow_group_key(p, "wsc"),
                lic="CC BY 4.0",
                source_url="https://data.mendeley.com/datasets/3wnf3n242s/4",
            )

    # 2. HuggingFace keremberke/pothole-segmentation -> road_damage
    pseg_dir = RAW_DIR / "hf_pothole_seg"
    if pseg_dir.is_dir():
        pseg_imgs = sorted(p for p in pseg_dir.rglob("*") if p.is_file() and p.suffix.lower() in IMG_EXTS)
        for i, p in enumerate(pseg_imgs):
            _stage_file(
                src=p,
                cls="road_damage",
                dst_name=f"pseg_{i:04d}{p.suffix.lower()}",
                source_dataset="keremberke/pothole-segmentation",
                source_group=_roboflow_group_key(p, "pseg"),
                lic="CC BY 4.0",
                source_url="https://huggingface.co/datasets/keremberke/pothole-segmentation",
            )

    # 3. HuggingFace Arpitraj01/Pothole_classification -> road_damage & unrelated (clean normal roads)
    pcls_dir = RAW_DIR / "hf_pothole_cls"
    if pcls_dir.is_dir():
        pcls_imgs = sorted(p for p in pcls_dir.rglob("*") if p.is_file() and p.suffix.lower() in IMG_EXTS)
        for i, p in enumerate(pcls_imgs):
            folder_cls = p.parent.name.lower()
            if folder_cls == "none":
                target_cls = "unrelated"
                prefix = "clean_normal_road"
            elif folder_cls in {"low", "medium", "severe"}:
                target_cls = "road_damage"
                prefix = f"pcls_{folder_cls}"
            else:
                continue
            _stage_file(
                src=p,
                cls=target_cls,
                dst_name=f"{prefix}_{i:04d}{p.suffix.lower()}",
                source_dataset="Arpitraj01/Pothole_classification",
                source_group=f"pcls:{folder_cls}:{p.stem}",
                lic="MIT",
                source_url="https://huggingface.co/datasets/Arpitraj01/Pothole_classification",
            )

    # 4. HuggingFace Akhila-9849/Garbage_Bin_overflow_images -> garbage
    gb_dir = RAW_DIR / "hf_garbage_bins"
    if gb_dir.is_dir():
        gb_imgs = sorted(p for p in gb_dir.rglob("*") if p.is_file() and p.suffix.lower() in IMG_EXTS)
        for i, p in enumerate(gb_imgs):
            _stage_file(
                src=p,
                cls="garbage",
                dst_name=f"gbin_{i:04d}{p.suffix.lower()}",
                source_dataset="Akhila-9849/Garbage_Bin_overflow_images",
                source_group=f"gbin:{p.stem}",
                lic="CC BY 4.0",
                source_url="https://huggingface.co/datasets/Akhila-9849/Garbage_Bin_overflow_images",
            )

    # 5. TACO street/wild litter subset -> garbage
    taco_dir = RAW_DIR / "taco_subset" / "images"
    if taco_dir.is_dir():
        taco_imgs = sorted(p for p in taco_dir.iterdir() if p.is_file() and p.suffix.lower() in IMG_EXTS)
        for i, p in enumerate(taco_imgs):
            _stage_file(
                src=p,
                cls="garbage",
                dst_name=f"taco_{i:04d}{p.suffix.lower()}",
                source_dataset="TACO (Zenodo 3587843)",
                source_group=f"taco:{p.stem}",
                lic="CC BY 4.0",
                source_url="https://zenodo.org/records/3587843",
            )

    # 6. Wikimedia Commons Verified Open-License Corpus
    wm_root = RAW_DIR / "wikimedia"
    wm_meta_path = wm_root / "metadata.json"
    wm_lookup: dict[tuple[str, str], dict] = {}
    if wm_meta_path.is_file():
        for row in json.loads(wm_meta_path.read_text(encoding="utf-8")):
            wm_lookup[(row["class"], row["filename"])] = row

    for cls_dir in sorted(wm_root.iterdir()) if wm_root.is_dir() else []:
        if not cls_dir.is_dir():
            continue
        cls_name = cls_dir.name
        if cls_name not in {"garbage", "drainage", "water_pollution", "road_damage", "sanitation", "unrelated"}:
            continue
        for p in sorted(cls_dir.iterdir()):
            if not p.is_file() or p.suffix.lower() not in IMG_EXTS:
                continue
            meta = wm_lookup.get((cls_name, p.name), {})
            q_slug = "".join(c if c.isalnum() else "_" for c in (meta.get("query") or cls_name).lower())[:28].strip("_")
            _stage_file(
                src=p,
                cls=cls_name,
                dst_name=f"wm_{q_slug}_{p.name}",
                source_dataset="Wikimedia Commons",
                source_group=f"wm:{cls_name}:{p.stem}",
                lic=meta.get("license", "CC-BY/CC0"),
                source_url=meta.get("source_url", "https://commons.wikimedia.org"),
            )

    manifest_path = STAGED_DIR / "staging_manifest.json"
    manifest_path.write_text(json.dumps(records, indent=2), encoding="utf-8")
    summary = {"total_staged": len(records), "class_counts": dict(sorted(counts.items()))}
    print(f"[prepare] Staged {len(records)} images into {STAGED_DIR}", flush=True)
    print(f"          class_counts={summary['class_counts']}", flush=True)
    return summary


if __name__ == "__main__":
    prepare_all_datasets()

