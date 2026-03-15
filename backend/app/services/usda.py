from __future__ import annotations

from typing import Any

import requests
from requests import RequestException, Timeout
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from ..schemas import BarcodeResult

_session = requests.Session()
_retry = Retry(
    total=2,
    backoff_factor=0.3,
    status_forcelist=(429, 500, 502, 503, 504),
    allowed_methods=frozenset(["GET"]),
)
_session.mount("https://", HTTPAdapter(max_retries=_retry))

USDA_HEADERS = {
    "User-Agent": "MacroTracker/1.0 (contact: support@example.com)",
}

USDA_SEARCH_URL = "https://api.nal.usda.gov/fdc/v1/foods/search"


def _safe_float(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _normalize_name(name: str | None) -> str:
    return (name or "").strip().lower()


def _find_nutrient(food_nutrients: list[dict[str, Any]], ids: set[int], names: list[str]) -> float | None:
    for nutrient in food_nutrients:
        nutrient_id = nutrient.get("nutrientId")
        if nutrient_id in ids:
            value = _safe_float(nutrient.get("value"))
            unit = _normalize_name(nutrient.get("unitName"))
            if value is None:
                continue
            if unit in {"kj", "kilojoule", "kilojoules"}:
                return value / 4.184
            return value
    for nutrient in food_nutrients:
        name = _normalize_name(nutrient.get("nutrientName"))
        if any(key in name for key in names):
            value = _safe_float(nutrient.get("value"))
            unit = _normalize_name(nutrient.get("unitName"))
            if value is None:
                continue
            if unit in {"kj", "kilojoule", "kilojoules"}:
                return value / 4.184
            return value
    return None


def search_usda_foods(query: str, api_key: str, limit: int = 10) -> list[BarcodeResult]:
    params = {
        "query": query,
        "pageSize": limit,
        "api_key": api_key,
    }
    try:
        response = _session.get(
            USDA_SEARCH_URL, params=params, timeout=(5, 12), headers=USDA_HEADERS
        )
        response.raise_for_status()
        payload = response.json()
    except Timeout as exc:
        raise TimeoutError("USDA search timed out.") from exc
    except RequestException as exc:
        raise RuntimeError("USDA search failed.") from exc

    results: list[BarcodeResult] = []
    for item in payload.get("foods", [])[:limit]:
        nutrients = item.get("foodNutrients", []) or []
        calories = _find_nutrient(
            nutrients,
            {1008, 2047},
            ["energy", "kcal"],
        )
        protein = _find_nutrient(
            nutrients,
            {1003},
            ["protein"],
        )
        carbs = _find_nutrient(
            nutrients,
            {1005},
            ["carbohydrate", "carb"],
        )
        fats = _find_nutrient(
            nutrients,
            {1004},
            ["total lipid", "fat"],
        )
        results.append(
            BarcodeResult(
                food_name=item.get("description") or "USDA item",
                calories=int(calories) if calories is not None else None,
                protein=protein,
                carbs=carbs,
                fats=fats,
                brand=item.get("brandOwner") or "USDA FDC",
                serving_size="100 g",
            )
        )
    return results
