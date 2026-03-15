from __future__ import annotations

from typing import Any

import requests
from requests import HTTPError, RequestException

from ..schemas import BarcodeResult

DEFAULT_HEADERS = {
    "User-Agent": "MacroTracker/1.0 (contact: support@example.com)",
}

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
    response = requests.get(url, timeout=10, headers=DEFAULT_HEADERS)
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


def search_foods(query: str, limit: int = 10) -> list[BarcodeResult]:
    url = "https://world.openfoodfacts.org/cgi/search.pl"
    params = {
        "search_terms": query,
        "search_simple": 1,
        "action": "process",
        "json": 1,
        "page_size": limit,
    }
    try:
        response = requests.get(url, params=params, timeout=10, headers=DEFAULT_HEADERS)
        response.raise_for_status()
        payload = response.json()
    except RequestException:
        fallback_url = "https://world.openfoodfacts.org/api/v2/search"
        fallback_params = {"search_terms": query, "page_size": limit}
        response = requests.get(
            fallback_url, params=fallback_params, timeout=10, headers=DEFAULT_HEADERS
        )
        response.raise_for_status()
        payload = response.json()

    results: list[BarcodeResult] = []
    for product in payload.get("products", [])[:limit]:
        nutriments = product.get("nutriments", {})
        calories = _safe_int(nutriments.get("energy-kcal_100g"))
        protein = _safe_float(nutriments.get("proteins_100g"))
        carbs = _safe_float(nutriments.get("carbohydrates_100g"))
        fats = _safe_float(nutriments.get("fat_100g"))
        results.append(
            BarcodeResult(
                food_name=product.get("product_name") or "Unknown item",
                calories=calories,
                protein=protein,
                carbs=carbs,
                fats=fats,
                brand=product.get("brands"),
                serving_size=product.get("serving_size"),
            )
        )
    return results
