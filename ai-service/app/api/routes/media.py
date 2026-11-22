import asyncio
import base64
import binascii
import os
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, File, HTTPException, Request, UploadFile, WebSocket
from pydantic import BaseModel, Field, ValidationError

from app.api.routes.analyze import AnalyzeRequest, analyze_payload
from app.services.gemini import GeminiError, gemini_analyze_image
from app.services.image_validator import get_image_validator_service
from app.services.language import SUPPORTED_LANGUAGES
from app.services.sarvam import transcribe_audio_sarvam, proxy_sarvam_ws

# Backward compatibility alias
transcribe_audio = transcribe_audio_sarvam


router = APIRouter()
MAX_AUDIO_BYTES = 20 * 1024 * 1024
MAX_IMAGE_BYTES = 8 * 1024 * 1024
_IMAGE_TYPES = {
    "image/jpeg": (b"\xff\xd8\xff",),
    "image/png": (b"\x89PNG\r\n\x1a\n",),
    "image/webp": (b"RIFF",),
}


class ImageAnalysisRequest(BaseModel):
    image_base64: str = Field(min_length=1, max_length=12_000_000)
    content_type: Literal["image/jpeg", "image/png", "image/webp"] | None = None
    text: str | None = Field(default=None, max_length=20_000)
    language: Literal["en", "hi", "mr"] | None = None


class ImageValidationRequest(BaseModel):
    image_base64: str = Field(min_length=1, max_length=12_000_000)
    content_type: str | None = None
    category: str = Field(default="", max_length=120)
    description: str = Field(default="", max_length=20_000)
    language: Literal["en", "hi", "mr", "auto"] | None = "auto"
    existing_hashes: list[str] = Field(default_factory=list, max_length=500)


def _decode_image(encoded: str, content_type: str | None) -> tuple[bytes, str]:
    if encoded.startswith("data:"):
        try:
            header, encoded = encoded.split(",", 1)
            content_type = header[5:].split(";", 1)[0]
        except ValueError as exc:
            raise ValueError("Invalid image data URL.") from exc
    try:
        image = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("Image must be valid base64 data.") from exc
    if not image or len(image) > MAX_IMAGE_BYTES:
        raise ValueError("Image must be smaller than 8 MB.")

    detected_type = next(
        (
            mime
            for mime, signatures in _IMAGE_TYPES.items()
            if any(image.startswith(signature) for signature in signatures)
        ),
        None,
    )
    if detected_type == "image/webp" and image[8:12] != b"WEBP":
        detected_type = None
    if detected_type is None or (content_type and content_type != detected_type):
        raise ValueError("Image must be a valid JPEG, PNG, or WebP file.")
    return image, detected_type


@router.post("/voice/transcribe")
async def transcribe_complaint(audio: UploadFile = File(...)):
    filename = Path(audio.filename or "").name
    suffix = Path(filename).suffix.lower()
    if not suffix:
        raise HTTPException(status_code=400, detail="Audio filename must include a supported extension.")

    content = await audio.read(MAX_AUDIO_BYTES + 1)
    await audio.close()
    if len(content) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Audio file must be smaller than 20 MB.")
    try:
        result = await asyncio.to_thread(transcribe_audio, content, filename)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    analysis = None
    try:
        analysis = await asyncio.to_thread(
            analyze_payload,
            AnalyzeRequest(text=result["text"], language=result["language"]),
        )
    except Exception:
        # Transcription must succeed even if LLM analysis is unavailable
        analysis = None

    return {**result, "analysis": analysis}


@router.websocket("/voice/stream")
async def voice_stream_websocket(websocket: WebSocket):
    """
    WebSocket endpoint for real-time speech-to-text streaming.
    Bridges client audio directly to Sarvam AI Saaras v4 WebSocket.
    """
    await websocket.accept()
    await proxy_sarvam_ws(websocket)


@router.post("/image/analyze")
def analyze_complaint_image(request: ImageAnalysisRequest):
    try:
        image, detected_type = _decode_image(request.image_base64, request.content_type)
        prompt = (
            "Describe only visible civic infrastructure or sanitation problems, such as potholes, "
            "damaged roads, overflowing garbage, blocked drains, or water leaks. Do not infer hidden "
            "causes, identities, addresses, or details that cannot be seen. If no civic problem is visible, say so."
        )
        if request.text:
            prompt += f"\nCitizen's note: {request.text.strip()}"

        image_description = gemini_analyze_image(
            image_bytes=image,
            mime_type=detected_type,
            prompt=prompt,
        )
        if request.text:
            analysis_text = f"{request.text.strip()}\nVisible evidence: {image_description}"
        else:
            analysis_text = image_description
        analysis = analyze_payload(
            AnalyzeRequest(text=analysis_text, language=request.language)
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except GeminiError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {"image_description": image_description, "analysis": analysis}


@router.post("/validate-image")
async def validate_evidence_image(request: Request):
    """Validate uploaded civic complaint evidence image (supports JSON base64 or multipart/form-data)."""
    ct = (request.headers.get("content-type") or "").lower()
    raw_bytes: bytes | None = None
    declared_type: str | None = None
    category = ""
    description = ""
    language: str | None = "auto"
    existing_hashes: list[str] = []

    if "multipart/form-data" in ct:
        form = await request.form()
        upload = form.get("image") or form.get("file")
        if upload is None or not hasattr(upload, "read"):
            raise HTTPException(status_code=400, detail="Multipart field 'image' is required.")
        raw_bytes = await upload.read(MAX_IMAGE_BYTES + 1)
        await upload.close()
        declared_type = getattr(upload, "content_type", None)
        category = str(form.get("category") or "")
        description = str(form.get("description") or "")
        language = str(form.get("language") or "auto")
        raw_hashes = form.get("existing_hashes")
        if isinstance(raw_hashes, str) and raw_hashes.strip():
            existing_hashes = [h.strip() for h in raw_hashes.split(",") if h.strip()]
    else:
        try:
            body_json = await request.json()
            payload = ImageValidationRequest.model_validate(body_json)
        except ValidationError as exc:
            raise HTTPException(status_code=422, detail=exc.errors()) from exc
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Invalid JSON payload.") from exc

        encoded = payload.image_base64.strip()
        if encoded.startswith("data:"):
            encoded = encoded.split(",", 1)[-1]
        try:
            raw_bytes = base64.b64decode(encoded, validate=True)
        except (ValueError, binascii.Error) as exc:
            raise HTTPException(status_code=400, detail="image_base64 must be valid base64 data.") from exc
        declared_type = payload.content_type
        category = payload.category
        description = payload.description
        language = payload.language
        existing_hashes = payload.existing_hashes

    if len(raw_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image file must be smaller than 8 MB.")

    try:
        validator = get_image_validator_service()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Image validation model unavailable: {exc}") from exc

    return await asyncio.to_thread(
        validator.validate_bytes,
        raw_bytes,
        category=category,
        description=description,
        language=language,
        declared_content_type=declared_type,
        existing_hashes=existing_hashes,
    )


@router.get("/voice/languages")
def get_supported_voice_languages():
    return {
        "languages": sorted(SUPPORTED_LANGUAGES),
        "transcription_model": os.getenv("SARVAM_MODEL", "saaras:v4"),
        "provider": "sarvam_ai",
    }
