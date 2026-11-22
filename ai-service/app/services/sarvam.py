import os
import json
import base64
import asyncio
from pathlib import Path
from typing import AsyncGenerator, Callable, Optional
import httpx
import websockets
from fastapi import WebSocket, WebSocketDisconnect

from app.services.transcription import transcribe_audio as transcribe_audio_whisper

SARVAM_API_URL = "https://api.sarvam.ai/speech-to-text"
SARVAM_WS_URL = "wss://api.sarvam.ai/speech-to-text/ws"


def map_sarvam_language(lang_code: Optional[str], text: str = "") -> str:
    """
    Maps Sarvam BCP-47 language codes to standard codes (mr, hi, en, mixed).
    """
    has_devanagari = any(0x0900 <= ord(c) <= 0x097F for c in text)
    has_latin = any(('a' <= c <= 'z' or 'A' <= c <= 'Z') for c in text)
    if has_devanagari and has_latin and len(text.split()) > 1:
        return "mixed"

    if not lang_code:
        # Fallback to Devanagari script detection
        if has_devanagari:
            marathi_keywords = {
                "आहे", "आहेत", "झाला", "झाली", "झाले", "कचरा", "खड्डा", "खड्डे",
                "पाणी", "रस्ता", "रस्ते", "गल्ली", "गल्लीत", "करा", "करावे",
                "आमच्या", "येथे", "नाही", "होते", "तक्रार", "पाहिजे", "लवकर",
                "माझं", "माझा", "माझे", "नाव", "मी", "सांगतो", "करतो", "काम", "द्या"
            }
            words = set(text.split())
            return "mr" if (words & marathi_keywords) else "hi"
        return "en"

    code = lang_code.lower()
    if code.startswith("mr"):
        return "mr"
    if code.startswith("hi"):
        return "hi"
    if code.startswith("en"):
        return "en"
    return "en"


def transcribe_audio_sarvam(
    audio: bytes,
    filename: str,
    model: str = "saaras:v4",
    mode: str = "codemix",
) -> dict:
    """
    Transcribes audio using Sarvam AI Saaras v4 REST API.
    Falls back to Whisper AI if SARVAM_API_KEY is not configured or on network error.
    """
    api_key = os.getenv("SARVAM_API_KEY", "").strip()

    if not api_key:
        return transcribe_audio_whisper(audio, filename)

    suffix = Path(filename).suffix.lower() or ".wav"
    mime_type = "audio/wav" if suffix == ".wav" else "audio/webm"

    headers = {
        "api-subscription-key": api_key,
    }
    data = {
        "model": os.getenv("SARVAM_MODEL", model),
        "mode": os.getenv("SARVAM_MODE", mode),
        "language_code": "unknown",  # Auto-detect language
    }
    files = {
        "file": (filename or "audio.wav", audio, mime_type),
    }

    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(
                SARVAM_API_URL,
                headers=headers,
                data=data,
                files=files,
            )

        if response.status_code == 200:
            payload = response.json()
            raw_text = payload.get("transcript", "").strip()
            raw_lang = payload.get("language_code", "unknown")
            mapped_lang = map_sarvam_language(raw_lang, raw_text)

            return {
                "text": raw_text,
                "language": "mr" if mapped_lang == "mixed" else mapped_lang,
                "detected_language": mapped_lang,
                "raw_language": raw_lang,
                "language_probability": 0.99,
                "provider": "sarvam_saaras_v4",
                "request_id": payload.get("request_id"),
            }
        else:
            print(f"[Sarvam AI] HTTP {response.status_code}: {response.text}. Falling back to Whisper.")
            return transcribe_audio_whisper(audio, filename)
    except Exception as exc:
        print(f"[Sarvam AI] Error calling Saaras v4: {exc}. Falling back to Whisper.")
        return transcribe_audio_whisper(audio, filename)


async def _fallback_whisper_ws(client_ws: WebSocket):
    """
    Fallback WebSocket transcription using local Whisper model.
    """
    try:
        await client_ws.send_json({
            "type": "status",
            "status": "ready",
            "provider": "whisper_fallback",
        })
    except Exception:
        return

    audio_buffer = bytearray()
    try:
        while True:
            client_msg = await client_ws.receive()
            if client_msg.get("type") == "websocket.disconnect":
                break

            if "bytes" in client_msg and client_msg["bytes"]:
                audio_buffer.extend(client_msg["bytes"])
            elif "text" in client_msg and client_msg["text"]:
                try:
                    payload = json.loads(client_msg["text"])
                    action = payload.get("action") or payload.get("type")
                    if action == "stop":
                        break
                    audio_b64 = payload.get("audio") or payload.get("data")
                    if isinstance(audio_b64, str):
                        audio_buffer.extend(base64.b64decode(audio_b64))
                except Exception:
                    pass

        if audio_buffer:
            res = await asyncio.to_thread(transcribe_audio_whisper, bytes(audio_buffer), "stream.wav")
            await client_ws.send_json({
                "type": "transcript",
                "transcript": res.get("text", ""),
                "language": res.get("language", "en"),
                "raw_language": res.get("language", "en"),
                "is_final": True,
            })
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        print(f"[Whisper WS Fallback] Error: {exc}")


async def proxy_sarvam_ws(client_ws: WebSocket):
    """
    WebSocket proxy bridging client audio chunks to Sarvam AI Saaras v4 streaming WebSocket.
    Relays progressive transcripts and detected languages back to the client in real time.
    """
    api_key = os.getenv("SARVAM_API_KEY", "").strip()
    model = os.getenv("SARVAM_MODEL", "saaras:v4")
    mode = os.getenv("SARVAM_MODE", "codemix")

    if not api_key:
        print("[Sarvam WS] No SARVAM_API_KEY set. Falling back to Whisper.")
        await _fallback_whisper_ws(client_ws)
        return

    upstream_url = f"{SARVAM_WS_URL}?model={model}&language-code=unknown&mode={mode}"
    headers = {"api-subscription-key": api_key}

    try:
        async with websockets.connect(upstream_url, additional_headers=headers, open_timeout=10) as sarvam_ws:
            await client_ws.send_json({
                "type": "status",
                "status": "ready",
                "provider": "sarvam_saaras_v4",
                "model": model,
                "mode": mode,
            })

            async def receive_from_sarvam():
                try:
                    async for raw_msg in sarvam_ws:
                        try:
                            msg = json.loads(raw_msg)
                            data = msg.get("data", {}) if isinstance(msg, dict) else {}
                            transcript = data.get("transcript", "") or msg.get("transcript", "")
                            raw_lang = data.get("language_code", "") or msg.get("language_code", "")
                            mapped_lang = map_sarvam_language(raw_lang, transcript)

                            if transcript or raw_lang:
                                await client_ws.send_json({
                                    "type": "transcript",
                                    "transcript": transcript,
                                    "language": mapped_lang,
                                    "raw_language": raw_lang,
                                    "is_final": False,
                                })
                        except json.JSONDecodeError:
                            pass
                except asyncio.CancelledError:
                    pass
                except Exception as exc:
                    print(f"[Sarvam WS] Receive error: {exc}")

            async def send_to_sarvam():
                try:
                    while True:
                        client_msg = await client_ws.receive()
                        if client_msg.get("type") == "websocket.disconnect":
                            break

                        if "text" in client_msg and client_msg["text"]:
                            try:
                                payload = json.loads(client_msg["text"])
                                action = payload.get("action") or payload.get("type")
                                if action == "stop":
                                    break

                                audio_data = payload.get("audio") or payload.get("data")
                                if audio_data:
                                    if isinstance(audio_data, dict):
                                        await sarvam_ws.send(json.dumps(audio_data))
                                    else:
                                        msg = {
                                            "audio": {
                                                "data": audio_data,
                                                "sample_rate": "16000",
                                                "encoding": "audio/wav",
                                            }
                                        }
                                        await sarvam_ws.send(json.dumps(msg))
                            except json.JSONDecodeError:
                                pass

                        elif "bytes" in client_msg and client_msg["bytes"]:
                            raw_bytes = client_msg["bytes"]
                            b64 = base64.b64encode(raw_bytes).decode("ascii")
                            msg = {
                                "audio": {
                                    "data": b64,
                                    "sample_rate": "16000",
                                    "encoding": "audio/wav",
                                }
                            }
                            await sarvam_ws.send(json.dumps(msg))
                except WebSocketDisconnect:
                    pass
                except asyncio.CancelledError:
                    pass

            recv_task = asyncio.create_task(receive_from_sarvam())
            send_task = asyncio.create_task(send_to_sarvam())

            done, pending = await asyncio.wait(
                [recv_task, send_task],
                return_when=asyncio.FIRST_COMPLETED,
            )
            for task in pending:
                task.cancel()

    except Exception as exc:
        print(f"[Sarvam WS] Upstream connection failed: {exc}. Using fallback.")
        await _fallback_whisper_ws(client_ws)
