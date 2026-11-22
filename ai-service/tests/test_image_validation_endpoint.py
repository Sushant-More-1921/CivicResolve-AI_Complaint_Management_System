import base64
import io

from fastapi.testclient import TestClient
from PIL import Image

from app.main import app


def _make_jpeg_bytes(color: tuple[int, int, int], size: tuple[int, int] = (240, 240)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color=color).save(buf, format="JPEG", quality=90)
    return buf.getvalue()


def test_validate_image_rejects_corrupt_or_invalid_base64():
    client = TestClient(app)
    resp = client.post(
        "/validate-image",
        json={
            "image_base64": "!!!not-valid-base64!!!",
            "category": "Waste & Garbage",
            "description": "Garbage pile near street corner.",
        },
    )
    assert resp.status_code == 400


def test_validate_image_rejects_oversized_payload():
    client = TestClient(app)
    huge = base64.b64encode(b"x" * (8 * 1024 * 1024 + 50)).decode("ascii")
    resp = client.post(
        "/validate-image",
        json={
            "image_base64": huge,
            "category": "Waste & Garbage",
            "description": "Garbage overflowing near road.",
        },
    )
    assert resp.status_code == 413


def test_validate_image_handles_blank_flat_and_corrupted_bytes():
    client = TestClient(app)
    flat_b64 = base64.b64encode(_make_jpeg_bytes((128, 128, 128), size=(300, 300))).decode("ascii")
    resp = client.post(
        "/validate-image",
        json={
            "image_base64": flat_b64,
            "content_type": "image/jpeg",
            "category": "Waste & Garbage",
            "description": "Garbage dump on main road.",
        },
    )
    # 200 INVALID once trained model is present; 503 if tested before training
    assert resp.status_code in (200, 503)
    if resp.status_code == 200:
        data = resp.json()
        assert data["status"] == "INVALID"
        assert data["image_quality"] == "low_quality"

    corrupt_b64 = base64.b64encode(b"\xff\xd8\xff\xe0BROKEN_TRUNCATED_JPEG").decode("ascii")
    resp2 = client.post(
        "/validate-image",
        json={
            "image_base64": corrupt_b64,
            "category": "Potholes & Roads",
            "description": "Deep pothole.",
        },
    )
    assert resp2.status_code in (200, 503)
    if resp2.status_code == 200:
        assert resp2.json()["status"] == "INVALID"


def test_validate_image_accepts_multipart_upload():
    client = TestClient(app)
    tiny_png_buf = io.BytesIO()
    Image.new("RGB", (64, 64), color=(15, 15, 15)).save(tiny_png_buf, format="PNG")
    resp = client.post(
        "/validate-image",
        files={"image": ("tiny.png", tiny_png_buf.getvalue(), "image/png")},
        data={
            "category": "Drainage",
            "description": "Blocked drain overflowing onto street.",
            "language": "en",
        },
    )
    assert resp.status_code in (200, 503)
    if resp.status_code == 200:
        body = resp.json()
        assert body["status"] == "INVALID"
        assert body["image_quality"] == "low_quality"

