import base64
import json
import os
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from dotenv import load_dotenv

# Ensure environment is loaded even when gemini.py is imported standalone
_root_env = Path(__file__).resolve().parents[3] / ".env"
_local_env = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(_root_env if _root_env.exists() else _local_env)


class GeminiError(RuntimeError):
    pass


def _get_api_key() -> str:
    key = os.getenv("GEMINI_API_KEY", "").strip()
    if not key:
        raise GeminiError("GEMINI_API_KEY is not configured in environment.")
    return key


def _get_model() -> str:
    return os.getenv("GEMINI_MODEL", "gemini-3.5-flash").strip()


def gemini_generate_text(
    prompt: str,
    *,
    system_instruction: str | None = None,
    timeout: float = 30.0,
) -> str:
    """
    Generates text using Google Gemini Flash API.
    """
    api_key = _get_api_key()
    model = _get_model()

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

    contents = []
    if system_instruction:
        contents.append({
            "role": "user",
            "parts": [{"text": f"SYSTEM INSTRUCTION: {system_instruction}\n\nTask: {prompt}"}],
        })
    else:
        contents.append({
            "role": "user",
            "parts": [{"text": prompt}],
        })

    payload = {
        "contents": contents,
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 1024,
        },
    }

    body = json.dumps(payload).encode("utf-8")
    req = Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urlopen(req, timeout=timeout) as response:
            result = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        err_msg = exc.read().decode("utf-8", errors="replace")
        raise GeminiError(f"Gemini API returned HTTP {exc.code}: {err_msg}") from exc
    except (URLError, TimeoutError, OSError) as exc:
        raise GeminiError(f"Gemini API connection failed: {exc}") from exc
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise GeminiError("Gemini returned invalid response payload.") from exc

    candidates = result.get("candidates", [])
    if not candidates:
        raise GeminiError("Gemini returned no candidates.")

    parts = candidates[0].get("content", {}).get("parts", [])
    if not parts or not parts[0].get("text"):
        raise GeminiError("Gemini returned an empty response.")

    return parts[0]["text"].strip()


def gemini_analyze_image(
    image_bytes: bytes,
    mime_type: str = "image/jpeg",
    prompt: str = "Describe only visible civic infrastructure or sanitation problems, such as potholes, damaged roads, overflowing garbage, blocked drains, or water leaks. Do not infer hidden causes, identities, or details that cannot be seen. If no civic problem is visible, say so.",
    *,
    timeout: float = 30.0,
) -> str:
    """
    Analyzes photo evidence using Google Gemini Vision (Flash multimodal).
    """
    api_key = _get_api_key()
    model = _get_model()

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

    encoded_b64 = base64.b64encode(image_bytes).decode("ascii")

    payload = {
        "contents": [{
            "parts": [
                {"text": prompt},
                {
                    "inline_data": {
                        "mime_type": mime_type,
                        "data": encoded_b64,
                    }
                },
            ]
        }],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 1024,
        },
    }

    body = json.dumps(payload).encode("utf-8")
    req = Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urlopen(req, timeout=timeout) as response:
            result = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        err_msg = exc.read().decode("utf-8", errors="replace")
        raise GeminiError(f"Gemini Vision API returned HTTP {exc.code}: {err_msg}") from exc
    except (URLError, TimeoutError, OSError) as exc:
        raise GeminiError(f"Gemini Vision API connection failed: {exc}") from exc
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise GeminiError("Gemini returned invalid response payload.") from exc

    candidates = result.get("candidates", [])
    if not candidates:
        raise GeminiError("Gemini returned no candidates.")

    parts = candidates[0].get("content", {}).get("parts", [])
    if not parts or not parts[0].get("text"):
        raise GeminiError("Gemini returned an empty response.")

    return parts[0]["text"].strip()
