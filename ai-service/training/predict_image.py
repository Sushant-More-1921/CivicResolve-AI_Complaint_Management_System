"""CLI and importable inference utility for CivicResolve image validation."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from app.services.image_validator import get_image_validator_service


def predict_evidence_image(
    image_path: str | Path,
    category: str = "",
    description: str = "",
    language: str = "auto",
    existing_hashes: list[str] | None = None,
) -> dict:
    p = Path(image_path)
    if not p.is_file():
        raise FileNotFoundError(f"Image file not found: {p}")
    service = get_image_validator_service()
    return service.validate_bytes(
        p.read_bytes(),
        category=category,
        description=description,
        language=language,
        existing_hashes=existing_hashes,
    )


def main():
    parser = argparse.ArgumentParser(description="Validate a civic evidence photo.")
    parser.add_argument("--image", required=True, help="Path to evidence image file")
    parser.add_argument("--category", default="", help="Selected complaint category")
    parser.add_argument("--description", default="", help="Citizen complaint description")
    parser.add_argument("--language", default="auto", choices=["auto", "en", "hi", "mr"])
    args = parser.parse_args()

    result = predict_evidence_image(
        args.image,
        category=args.category,
        description=args.description,
        language=args.language,
    )
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()

