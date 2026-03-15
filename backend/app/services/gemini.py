from __future__ import annotations

from io import BytesIO

from google import genai
from google.genai import types
from PIL import Image

from ..schemas import FoodEstimate


SYSTEM_PROMPT = (
    "Analyze the food in this image. Estimate portion sizes. "
    "Return ONLY a JSON object with keys: food_name, calories, protein, carbs, fats, "
    "confidence, notes, questions. Notes must be a string; use an empty string if none. "
    "Questions must be an array of strings; use an empty array if none."
)


def analyze_food_image(image_bytes: bytes, api_key: str | None, model: str) -> FoodEstimate:
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set.")

    client = genai.Client(api_key=api_key)
    image = Image.open(BytesIO(image_bytes)).convert("RGB")

    response = client.models.generate_content(
        model=model,
        contents=[image, SYSTEM_PROMPT],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=FoodEstimate,
        ),
    )

    if not response.text:
        raise RuntimeError("Gemini returned an empty response.")

    return FoodEstimate.model_validate_json(response.text)
