from contextlib import asynccontextmanager
from importlib.util import find_spec
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI

from app.api.routes.analyze import router as analyze_router
from app.api.routes.similar import router as similar_router
from app.api.routes.hotspot import router as hotspot_router
from app.api.routes.media import router as media_router
from app.api.routes.verify import router as verify_router
from app.api.routes.priority import router as priority_router

_root_env = Path(__file__).resolve().parents[2] / ".env"
_local_env = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(_root_env if _root_env.exists() else _local_env)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm up models once at startup to eliminate cold-start inference lag
    try:
        from app.services.image_validator import get_image_validator_service
        get_image_validator_service()
    except Exception as exc:
        print(f"[startup] Image validator model warmup: {exc}")
    yield


app = FastAPI(
    title="CivicResolve AI Service",
    description="AI service for civic complaint classification, verification, and prioritization",
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(verify_router)
app.include_router(priority_router)
app.include_router(analyze_router)
app.include_router(similar_router)
app.include_router(hotspot_router)
app.include_router(media_router)


@app.get("/")
def root():
    return {
        "message": "CivicResolve AI Service is running"
    }


@app.get("/health")
def health():
    models_dir = Path(__file__).resolve().parents[1] / "models"
    return {
        "status": "healthy",
        "features": {
            "text_analysis": True,
            "image_validation": (models_dir / "image_validator" / "classifier_head.pt").is_file(),
            "whisper_transcription": find_spec("faster_whisper") is not None,
            "similarity_dependencies": (
                find_spec("sentence_transformers") is not None
                and find_spec("faiss") is not None
            ),
        },
    }
