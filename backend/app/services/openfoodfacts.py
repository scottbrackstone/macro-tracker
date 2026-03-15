from __future__ import annotations

from typing import Any

import requests
from requests import HTTPError

from ..schemas import BarcodeResult


def _safe_float(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _safe_int(value: Any) -> int | None:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def fetch_barcode(barcode: str) -> BarcodeResult:
    url = f"https://world.openfoodfacts.org/api/v2/product/{barcode}.json"
    response = requests.get(url, timeout=10)
    try:
        response.raise_for_status()
    except HTTPError as exc:
        raise ValueError("Barcode not found.") from exc
    payload = response.json()

    if payload.get("status") != 1:
        raise ValueError("Barcode not found.")

    product = payload.get("product", {})
    nutriments = product.get("nutriments", {})

    calories = _safe_int(nutriments.get("energy-kcal_100g"))
    protein = _safe_float(nutriments.get("proteins_100g"))
    carbs = _safe_float(nutriments.get("carbohydrates_100g"))
    fats = _safe_float(nutriments.get("fat_100g"))

    return BarcodeResult(
        food_name=product.get("product_name") or "Unknown product",
        calories=calories,
        protein=protein,
        carbs=carbs,
        fats=fats,
        brand=product.get("brands"),
        serving_size=product.get("serving_size"),
    )
