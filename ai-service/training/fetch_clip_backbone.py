"""Download and verify local openai/clip-vit-base-patch32 weights for fast offline startup."""

from __future__ import annotations

import hashlib
import time
from pathlib import Path

from download_datasets import BASE_DIR, download_file

CLIP_DIR = BASE_DIR / "models" / "clip_backbone"
CLIP_REPO = "openai/clip-vit-base-patch32"
CLIP_FILES = [
    ("config.json", False, None),
    ("preprocessor_config.json", False, None),
    ("tokenizer_config.json", False, None),
    ("special_tokens_map.json", False, None),
    ("tokenizer.json", False, None),
    ("vocab.json", False, None),
    ("merges.txt", False, None),
    ("pytorch_model.bin", True, "a63082132ba4f97a80bea76823f544493bffa8082296d62d71581a4feff1576f"),
]


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        while True:
            chunk = fh.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def ensure_clip_backbone() -> Path:
    CLIP_DIR.mkdir(parents=True, exist_ok=True)
    for filename, is_large, expected_sha in CLIP_FILES:
        dest = CLIP_DIR / filename
        url = f"https://huggingface.co/{CLIP_REPO}/resolve/main/{filename}"
        if dest.exists() and expected_sha:
            if _sha256(dest) == expected_sha:
                print(f"[clip] Verified cached {filename}", flush=True)
                continue
            print(f"[clip] Checksum mismatch for {filename}, re-downloading...", flush=True)
            dest.unlink(missing_ok=True)

        print(f"[clip] Fetching {filename}...", flush=True)
        ok, size, note = download_file(url, dest, timeout=900, large_parallel=is_large)
        if not ok:
            raise RuntimeError(f"Failed downloading CLIP asset {filename}: {note}")
        if expected_sha:
            actual = _sha256(dest)
            if actual != expected_sha:
                dest.unlink(missing_ok=True)
                raise RuntimeError(f"SHA256 mismatch on {filename}: expected {expected_sha}, got {actual}")
        print(f"[clip] Ready: {filename} ({size / (1024**2):.2f} MB, {note})", flush=True)

    return CLIP_DIR


if __name__ == "__main__":
    t0 = time.time()
    out_dir = ensure_clip_backbone()
    from transformers import CLIPModel, CLIPProcessor

    model = CLIPModel.from_pretrained(str(out_dir), local_files_only=True)
    processor = CLIPProcessor.from_pretrained(str(out_dir), local_files_only=True)
    print(
        f"[clip] Verified local CLIP ViT-B/32 load in {time.time() - t0:.2f}s "
        f"(proj_dim={model.config.projection_dim}, patch_size={processor.image_processor.size})",
        flush=True,
    )

