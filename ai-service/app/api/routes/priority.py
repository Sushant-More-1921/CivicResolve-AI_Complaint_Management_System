from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.priority import priority_predictor

router = APIRouter(prefix="/priority", tags=["Priority"])

class PriorityPredictRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=20_000, description="Civic complaint text description")
    category: Optional[str] = Field(None, description="Optional complaint category (e.g. Roads, Drainage, Electricity)")
    latitude: Optional[float] = Field(None, ge=-90, le=90, description="Geographic latitude")
    longitude: Optional[float] = Field(None, ge=-180, le=180, description="Geographic longitude")
    similarity_count: Optional[int] = Field(None, ge=0, description="Count of duplicate or nearby similar complaints")

class PriorityPredictResponse(BaseModel):
    priority: str
    confidence: float
    severity_score: float
    source: str
    model_version: str
    timestamp: str
    explanation: str
    contributing_factors: List[str]
    probabilities: Dict[str, float]

class BatchItem(BaseModel):
    id: Optional[str] = None
    text: str = Field(..., min_length=1, max_length=20_000)
    category: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    similarity_count: Optional[int] = None

class BatchPriorityRequest(BaseModel):
    complaints: List[BatchItem] = Field(..., max_length=100)

class BatchPriorityResponse(BaseModel):
    total: int
    results: List[Dict[str, Any]]

@router.post("/predict", response_model=PriorityPredictResponse)
def predict_priority(request: PriorityPredictRequest):
    """
    Predict priority tier (Critical, High, Medium, Low) for an individual complaint.
    Returns calibrated confidence, severity score, rationale explanation, and contributing factors.
    """
    try:
        result = priority_predictor.predict(
            text=request.text,
            category=request.category,
            latitude=request.latitude,
            longitude=request.longitude,
            similarity_count=request.similarity_count,
        )
        return result
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err)) from val_err
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Priority prediction failed: {exc}") from exc

@router.post("/batch-predict", response_model=BatchPriorityResponse)
def batch_predict_priority(request: BatchPriorityRequest):
    """
    Batch predict priority for multiple complaints simultaneously (up to 100).
    """
    items = [item.model_dump() for item in request.complaints]
    results = priority_predictor.batch_predict(items)
    return {
        "total": len(results),
        "results": results
    }

