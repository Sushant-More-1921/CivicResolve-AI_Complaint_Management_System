"""Shared image integrity, perceptual hashing (dHash), and quality telemetry utilities."""

from __future__ import annotations

import cv2
import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

ALLOWED_MIME_MAGIC = {
    "image/jpeg": (b"\xff\xd8\xff",),
    "image/png": (b"\x89PNG\r\n\x1a\n",),
    "image/webp": (b"RIFF",),
}


def detect_mime_from_bytes(raw: bytes) -> str | None:
    """Identify supported image MIME type strictly from binary header bytes."""
    for mime, prefixes in ALLOWED_MIME_MAGIC.items():
        if any(raw.startswith(prefix) for prefix in prefixes):
            if mime == "image/webp" and (len(raw) < 12 or raw[8:12] != b"WEBP"):
                continue
            return mime
    return None


def decode_pil_rgb(raw: bytes) -> tuple[Image.Image | None, np.ndarray | None, str | None]:
    """Safely decode raw image bytes into an EXIF-oriented RGB PIL image and ndarray."""
    import io

    try:
        with Image.open(io.BytesIO(raw)) as im:
            im.verify()
        with Image.open(io.BytesIO(raw)) as im2:
            rgb_pil = ImageOps.exif_transpose(im2).convert("RGB")
            return rgb_pil, np.asarray(rgb_pil), None
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError) as exc:
        return None, None, f"corrupted:{type(exc).__name__}"


def compute_dhash(img: Image.Image, hash_size: int = 8) -> int:
    """Compute a 64-bit difference hash (dHash) invariant to minor scaling/compression."""
    gray = ImageOps.exif_transpose(img).convert("L").resize(
        (hash_size + 1, hash_size), Image.Resampling.LANCZOS
    )
    arr = np.asarray(gray, dtype=np.int16)
    diff = arr[:, 1:] > arr[:, :-1]
    value = 0
    for bit in diff.flatten():
        value = (value << 1) | int(bool(bit))
    return value


def hamming_distance(h1: int, h2: int) -> int:
    return (h1 ^ h2).bit_count()


def compute_quality_metrics(rgb: np.ndarray) -> dict:
    """Compute resolution, blur (Laplacian/Tenengrad), exposure, and Shannon entropy."""
    h, w = rgb.shape[:2]
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)

    # Normalize long edge to 512px so blur thresholds remain consistent across phone cameras
    scale = 512.0 / max(h, w)
    if scale < 1.0:
        gray_norm = cv2.resize(
            gray,
            (max(32, int(w * scale)), max(32, int(h * scale))),
            interpolation=cv2.INTER_AREA,
        )
    else:
        gray_norm = gray

    laplacian_var = float(cv2.Laplacian(gray_norm, cv2.CV_64F).var())
    gx = cv2.Sobel(gray_norm, cv2.CV_64F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray_norm, cv2.CV_64F, 0, 1, ksize=3)
    tenengrad = float(np.mean(gx * gx + gy * gy))

    mean_luma = float(np.mean(gray))
    std_luma = float(np.std(gray))
    dark_ratio = float(np.mean(gray < 20))
    bright_ratio = float(np.mean(gray > 245))

    hist = cv2.calcHist([gray], [0], None, [64], [0, 256]).ravel()
    probs = hist / max(hist.sum(), 1.0)
    nz = probs[probs > 0]
    entropy = float(-np.sum(nz * np.log2(nz)))

    return {
        "width": int(w),
        "height": int(h),
        "laplacian_var": round(laplacian_var, 2),
        "tenengrad": round(tenengrad, 2),
        "mean_luma": round(mean_luma, 2),
        "std_luma": round(std_luma, 2),
        "dark_ratio": round(dark_ratio, 4),
        "bright_ratio": round(bright_ratio, 4),
        "entropy": round(entropy, 3),
    }


def assess_image_quality(rgb: np.ndarray, min_width: int = 160, min_height: int = 160) -> tuple[str, dict, list[str]]:
    """Return ('good' | 'low_quality', metrics, reasons) using objective thresholds."""
    metrics = compute_quality_metrics(rgb)
    reasons: list[str] = []

    if metrics["width"] < min_width or metrics["height"] < min_height:
        reasons.append("low_resolution")
    if metrics["mean_luma"] < 24.0 or metrics["dark_ratio"] > 0.88:
        reasons.append("extremely_dark")
    if metrics["mean_luma"] > 238.0 or metrics["bright_ratio"] > 0.85:
        reasons.append("overexposed")
    if metrics["entropy"] < 2.2 or metrics["std_luma"] < 10.0:
        reasons.append("low_visual_information")
    if metrics["laplacian_var"] < 18.0 and metrics["tenengrad"] < 65.0:
        reasons.append("severely_blurred")

    status = "low_quality" if reasons else "good"
    return status, metrics, reasons

