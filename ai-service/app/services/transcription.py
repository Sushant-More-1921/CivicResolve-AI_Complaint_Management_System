import os
import tempfile
from pathlib import Path
from threading import Lock


_model = None
_model_lock = Lock()

_AUDIO_SUFFIXES = {
    ".flac", ".m4a", ".mp3", ".mp4", ".mpeg", ".ogg", ".wav", ".webm",
}


def transcribe_audio(audio: bytes, filename: str) -> dict:
    global _model

    if not audio:
        raise ValueError("Audio file is empty.")

    suffix = Path(filename).suffix.lower()
    if suffix not in _AUDIO_SUFFIXES:
        raise ValueError(
            "Unsupported audio format. Use WAV, MP3, M4A, MP4, MPEG, OGG, FLAC, or WebM."
        )

    if _model is None:
        with _model_lock:
            if _model is None:
                try:
                    from faster_whisper import WhisperModel
                except ImportError as exc:
                    raise RuntimeError(
                        "Voice transcription is not installed. Install "
                        "requirements-voice.txt to enable it."
                    ) from exc

                _model = WhisperModel(
                    os.getenv("WHISPER_MODEL_SIZE", "base"),
                    device=os.getenv("WHISPER_DEVICE", "cpu"),
                    compute_type=os.getenv("WHISPER_COMPUTE_TYPE", "int8"),
                )

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as audio_file:
        audio_file.write(audio)
        audio_path = audio_file.name

    try:
        # Transcribe verbatim in the exact detected language without alteration or translation
        segments, info = _model.transcribe(
            audio_path,
            beam_size=1,
            temperature=0.0,
            task="transcribe",
            vad_filter=True,
        )
        transcript = " ".join(
            segment.text.strip() for segment in segments if segment.text.strip()
        ).strip()
    finally:
        try:
            os.unlink(audio_path)
        except OSError:
            pass

    if not transcript:
        raise ValueError("No speech could be detected in the audio.")
    
    detected_language = getattr(info, "language", None)
    # Auto-detect language supporting mixed language / code-switching
    if detected_language not in {"en", "hi", "mr"}:
        has_devanagari = any(0x0900 <= ord(c) <= 0x097F for c in transcript)
        if has_devanagari:
            marathi_keywords = {
                "आहे", "आहेत", "झाला", "झाली", "झाले", "कचरा", "खड्डा", "खड्डे",
                "पाणी", "रस्ता", "रस्ते", "गल्ली", "गल्लीत", "करा", "करावे",
                "आमच्या", "येथे", "नाही", "होते", "तक्रार", "पाहिजे", "लवकर",
                "माझं", "माझे", "नाव", "मी"
            }
            words = set(transcript.split())
            detected_language = "mr" if (words & marathi_keywords) else "hi"
        else:
            detected_language = "en"

    return {
        "text": transcript,
        "language": detected_language,
        "language_probability": round(
            float(getattr(info, "language_probability", 0.0)), 4
        ),
    }
