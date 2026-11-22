from typing import Literal
from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.verifier import complaint_verifier

router = APIRouter()

class VerifyDescriptionRequest(BaseModel):
    description: str = Field(min_length=0, max_length=10_000)
    selected_category: str | None = Field(default=None)
    language: str | None = Field(default="auto")

class VerifyDescriptionResponse(BaseModel):
    is_relevant: bool
    predicted_category: str | None
    confidence: float
    status: Literal["verified", "mismatch", "review_required", "invalid"]
    message: str
    suggested_category: str | None = None
    suggested_category_key: str | None = None

@router.post("/complaints/verify-description", response_model=VerifyDescriptionResponse)
def verify_complaint_description(request: VerifyDescriptionRequest):
    result = complaint_verifier.verify_description(
        description=request.description,
        selected_category=request.selected_category,
        language=request.language or "auto",
    )
    return result

