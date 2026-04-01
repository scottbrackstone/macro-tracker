from __future__ import annotations

from datetime import date, datetime, time, timedelta
import json
from typing import List

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from sqlalchemy import func

from .db import get_session, init_db
from .models import (
    CustomFood,
    DailyLog,
    ExerciseLog,
    FoodItem,
    MacroTarget,
    Recipe,
    UserProfile,
    WeightLog,
    WaterLog,
)
from .schemas import (
    BarcodeResult,
    BulkLogRequest,
    DailyLogCreate,
    DailyLogRead,
    DailySummary,
    ExerciseLogCreate,
    ExerciseLogRead,
    FoodAnalysisItem,
    FoodAnalysisResponse,
    FoodItemCreate,
    FoodItemFavorite,
    FoodItemRead,
    FoodEstimate,
    MacroTargetRead,
    MacroTargetUpsert,
    RecentMeal,
    RecipeCreate,
    RecipeIngredient,
    RecipeRead,
    UserProfileRead,
    UserProfileUpsert,
    WaterLogCreate,
    WaterLogRead,
    WeightLogCreate,
    WeightLogRead,
)
from .services.gemini import analyze_food_image
from .services.openfoodfacts import fetch_barcode, search_foods
from .services.usda import search_usda_foods
from .settings import get_settings

settings = get_settings()

app = FastAPI(title="Macro Tracker API")

origins = settings.allowed_origins or ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _parse_ingredients(raw: str) -> list[RecipeIngredient]:
    try:
        payload = json.loads(raw) if raw else []
    except json.JSONDecodeError:
        payload = []
    ingredients: list[RecipeIngredient] = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        ingredients.append(
            RecipeIngredient(
                name=str(item.get("name") or "Ingredient"),
                calories=int(item.get("calories") or 0),
                protein=float(item.get("protein") or 0),
                carbs=float(item.get("carbs") or 0),
                fats=float(item.get("fats") or 0),
                grams=float(item.get("grams") or 100),
            )
        )
    return ingredients


def _serialize_recipe(recipe: Recipe) -> RecipeRead:
    ingredients = _parse_ingredients(recipe.ingredients_json)
    return RecipeRead(
        id=recipe.id,
        name=recipe.name,
        servings=recipe.servings,
        calories=recipe.calories,
        protein=recipe.protein,
        carbs=recipe.carbs,
        fats=recipe.fats,
        ingredients=ingredients,
        created_at=recipe.created_at,
    )


def _resolve_log_values(payload: DailyLogCreate) -> dict:
    grams = payload.grams if payload.grams and payload.grams > 0 else None
    base_calories = (
        payload.base_calories if payload.base_calories is not None else payload.calories
    )
    base_protein = (
        payload.base_protein if payload.base_protein is not None else payload.protein
    )
    base_carbs = (
        payload.base_carbs if payload.base_carbs is not None else payload.carbs
    )
    base_fats = payload.base_fats if payload.base_fats is not None else payload.fats
    use_scaling = (
        payload.grams is not None
        or payload.base_calories is not None
        or payload.base_protein is not None
        or payload.base_carbs is not None
        or payload.base_fats is not None
    )
    safe_grams = grams if grams is not None else 100
    if use_scaling:
        factor = safe_grams / 100
        calories = int(round((base_calories or 0) * factor))
        protein = float((base_protein or 0) * factor)
        carbs = float((base_carbs or 0) * factor)
        fats = float((base_fats or 0) * factor)
    else:
        calories = payload.calories
        protein = payload.protein
        carbs = payload.carbs
        fats = payload.fats
        safe_grams = grams
    return {
        "grams": safe_grams,
        "base_calories": base_calories,
        "base_protein": base_protein,
        "base_carbs": base_carbs,
        "base_fats": base_fats,
        "calories": calories,
        "protein": protein,
        "carbs": carbs,
        "fats": fats,
    }


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/")
def root() -> dict:
    return {"status": "ok"}


@app.post("/log-meal", response_model=DailyLogRead)
def log_meal(payload: DailyLogCreate, session: Session = Depends(get_session)) -> DailyLog:
    timestamp = payload.timestamp or datetime.utcnow()
    resolved = _resolve_log_values(payload)
    log = DailyLog(
        timestamp=timestamp,
        food_name=payload.food_name,
        source=payload.source,
        meal_slot=payload.meal_slot or 1,
        calories=resolved["calories"],
        protein=resolved["protein"],
        carbs=resolved["carbs"],
        fats=resolved["fats"],
        grams=resolved["grams"],
        base_calories=resolved["base_calories"],
        base_protein=resolved["base_protein"],
        base_carbs=resolved["base_carbs"],
        base_fats=resolved["base_fats"],
    )
    session.add(log)
    session.commit()
    session.refresh(log)
    return log


@app.put("/log-meal/{log_id}", response_model=DailyLogRead)
def update_log_meal(
    log_id: int, payload: DailyLogCreate, session: Session = Depends(get_session)
) -> DailyLog:
    log = session.get(DailyLog, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Meal log not found.")
    resolved = _resolve_log_values(payload)
    log.timestamp = payload.timestamp or log.timestamp
    log.food_name = payload.food_name
    log.source = payload.source
    log.meal_slot = payload.meal_slot or 1
    log.calories = resolved["calories"]
    log.protein = resolved["protein"]
    log.carbs = resolved["carbs"]
    log.fats = resolved["fats"]
    log.grams = resolved["grams"]
    log.base_calories = resolved["base_calories"]
    log.base_protein = resolved["base_protein"]
    log.base_carbs = resolved["base_carbs"]
    log.base_fats = resolved["base_fats"]
    session.add(log)
    session.commit()
    session.refresh(log)
    return log


@app.post("/log-meals/bulk", response_model=List[DailyLogRead])
def log_meals_bulk(payload: BulkLogRequest, session: Session = Depends(get_session)) -> List[DailyLog]:
    if not payload.dates:
        raise HTTPException(status_code=400, detail="No dates provided.")
    resolved = _resolve_log_values(payload.meal)
    unique_dates = sorted(set(payload.dates))
    logs: List[DailyLog] = []
    for target_date in unique_dates:
        timestamp = datetime.combine(target_date, time.min)
        log = DailyLog(
            timestamp=timestamp,
            food_name=payload.meal.food_name,
            source=payload.meal.source,
            meal_slot=payload.meal.meal_slot or 1,
            calories=resolved["calories"],
            protein=resolved["protein"],
            carbs=resolved["carbs"],
            fats=resolved["fats"],
            grams=resolved["grams"],
            base_calories=resolved["base_calories"],
            base_protein=resolved["base_protein"],
            base_carbs=resolved["base_carbs"],
            base_fats=resolved["base_fats"],
        )
        session.add(log)
        logs.append(log)
    session.commit()
    for log in logs:
        session.refresh(log)
    return logs


@app.get("/macro-target", response_model=MacroTargetRead)
def get_macro_target(session: Session = Depends(get_session)) -> MacroTarget:
    target = session.exec(select(MacroTarget).order_by(MacroTarget.id)).first()
    if not target:
        target = MacroTarget()
        session.add(target)
        session.commit()
        session.refresh(target)
    return target


@app.put("/macro-target", response_model=MacroTargetRead)
def upsert_macro_target(
    payload: MacroTargetUpsert, session: Session = Depends(get_session)
) -> MacroTarget:
    target = session.exec(select(MacroTarget).order_by(MacroTarget.id)).first()
    if not target:
        target = MacroTarget()
        session.add(target)
    target.calories = payload.calories
    target.protein = payload.protein
    target.carbs = payload.carbs
    target.fats = payload.fats
    target.meals_per_day = payload.meals_per_day
    target.updated_at = datetime.utcnow()
    session.commit()
    session.refresh(target)
    return target


@app.delete("/log-meal/{log_id}")
def delete_log(log_id: int, session: Session = Depends(get_session)) -> dict:
    log = session.get(DailyLog, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Log not found.")
    session.delete(log)
    session.commit()
    return {"status": "deleted", "id": log_id}


@app.get("/daily-summary", response_model=DailySummary)
def daily_summary(target_date: date | None = None, session: Session = Depends(get_session)) -> DailySummary:
    summary_date = target_date or date.today()
    start = datetime.combine(summary_date, time.min)
    end = datetime.combine(summary_date, time.max)

    statement = (
        select(
            func.coalesce(func.sum(DailyLog.calories), 0),
            func.coalesce(func.sum(DailyLog.protein), 0.0),
            func.coalesce(func.sum(DailyLog.carbs), 0.0),
            func.coalesce(func.sum(DailyLog.fats), 0.0),
        )
        .where(DailyLog.timestamp >= start)
        .where(DailyLog.timestamp <= end)
    )
    calories, protein, carbs, fats = session.exec(statement).one()
    return DailySummary(
        date=summary_date.isoformat(),
        calories=int(calories),
        protein=float(protein),
        carbs=float(carbs),
        fats=float(fats),
    )


@app.get("/daily-summaries", response_model=List[DailySummary])
def daily_summaries(
    start_date: date, end_date: date, session: Session = Depends(get_session)
) -> List[DailySummary]:
    if end_date < start_date:
        raise HTTPException(status_code=400, detail="Invalid date range.")
    start = datetime.combine(start_date, time.min)
    end = datetime.combine(end_date, time.max)
    statement = (
        select(DailyLog)
        .where(DailyLog.timestamp >= start)
        .where(DailyLog.timestamp <= end)
    )
    logs = session.exec(statement).all()
    summary_map: dict[str, dict[str, float]] = {}
    for log in logs:
        key = log.timestamp.date().isoformat()
        if key not in summary_map:
            summary_map[key] = {"calories": 0, "protein": 0, "carbs": 0, "fats": 0}
        summary_map[key]["calories"] += log.calories
        summary_map[key]["protein"] += log.protein
        summary_map[key]["carbs"] += log.carbs
        summary_map[key]["fats"] += log.fats
    # Fill in missing dates with zeros
    results: List[DailySummary] = []
    cursor = start_date
    while cursor <= end_date:
        key = cursor.isoformat()
        day = summary_map.get(
            key, {"calories": 0, "protein": 0, "carbs": 0, "fats": 0}
        )
        results.append(
            DailySummary(
                date=key,
                calories=int(day["calories"]),
                protein=float(day["protein"]),
                carbs=float(day["carbs"]),
                fats=float(day["fats"]),
            )
        )
        cursor = cursor + timedelta(days=1)
    return results


@app.get("/food-analysis", response_model=FoodAnalysisResponse)
def food_analysis(
    start_date: date, end_date: date, session: Session = Depends(get_session)
) -> FoodAnalysisResponse:
    if end_date < start_date:
        raise HTTPException(status_code=400, detail="Invalid date range.")
    start = datetime.combine(start_date, time.min)
    end = datetime.combine(end_date, time.max)
    logs = session.exec(
        select(DailyLog)
        .where(DailyLog.timestamp >= start)
        .where(DailyLog.timestamp <= end)
    ).all()
    summary: dict[str, FoodAnalysisItem] = {}
    for log in logs:
        key = log.food_name.strip().lower()
        if not key:
            continue
        if key not in summary:
            summary[key] = FoodAnalysisItem(
                food_name=log.food_name,
                calories=0,
                protein=0,
                carbs=0,
                fats=0,
                count=0,
            )
        item = summary[key]
        item.calories += log.calories or 0
        item.protein += log.protein or 0
        item.carbs += log.carbs or 0
        item.fats += log.fats or 0
        item.count += 1

    items = list(summary.values())
    top_calories = sorted(items, key=lambda x: x.calories, reverse=True)[:5]
    top_protein = sorted(items, key=lambda x: x.protein, reverse=True)[:5]
    return FoodAnalysisResponse(
        top_calories=top_calories,
        top_protein=top_protein,
    )


@app.get("/daily-logs", response_model=List[DailyLogRead])
def daily_logs(target_date: date | None = None, session: Session = Depends(get_session)) -> List[DailyLog]:
    summary_date = target_date or date.today()
    start = datetime.combine(summary_date, time.min)
    end = datetime.combine(summary_date, time.max)
    statement = (
        select(DailyLog)
        .where(DailyLog.timestamp >= start)
        .where(DailyLog.timestamp <= end)
        .order_by(DailyLog.timestamp.desc())
    )
    return session.exec(statement).all()


@app.get("/weight-logs", response_model=List[WeightLogRead])
def weight_logs(limit: int = 30, session: Session = Depends(get_session)) -> List[WeightLog]:
    statement = select(WeightLog).order_by(WeightLog.log_date.desc()).limit(limit)
    return session.exec(statement).all()


@app.post("/weight-logs", response_model=WeightLogRead)
def create_weight_log(
    payload: WeightLogCreate, session: Session = Depends(get_session)
) -> WeightLog:
    log = WeightLog(
        log_date=payload.log_date or date.today(),
        weight=payload.weight,
        notes=payload.notes,
    )
    session.add(log)
    session.commit()
    session.refresh(log)
    return log


@app.delete("/weight-logs/{log_id}")
def delete_weight_log(log_id: int, session: Session = Depends(get_session)) -> dict:
    log = session.get(WeightLog, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Weight log not found.")
    session.delete(log)
    session.commit()
    return {"status": "deleted", "id": log_id}


@app.get("/water-logs", response_model=List[WaterLogRead])
def water_logs(
    target_date: date | None = None, session: Session = Depends(get_session)
) -> List[WaterLog]:
    summary_date = target_date or date.today()
    start = datetime.combine(summary_date, time.min)
    end = datetime.combine(summary_date, time.max)
    statement = (
        select(WaterLog)
        .where(WaterLog.timestamp >= start)
        .where(WaterLog.timestamp <= end)
        .order_by(WaterLog.timestamp.desc())
    )
    return session.exec(statement).all()


@app.post("/water-logs", response_model=WaterLogRead)
def create_water_log(
    payload: WaterLogCreate, session: Session = Depends(get_session)
) -> WaterLog:
    timestamp = payload.timestamp or datetime.utcnow()
    log = WaterLog(timestamp=timestamp, amount_ml=payload.amount_ml)
    session.add(log)
    session.commit()
    session.refresh(log)
    return log


@app.delete("/water-logs/{log_id}")
def delete_water_log(log_id: int, session: Session = Depends(get_session)) -> dict:
    log = session.get(WaterLog, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Water log not found.")
    session.delete(log)
    session.commit()
    return {"status": "deleted", "id": log_id}


@app.get("/exercise-logs", response_model=List[ExerciseLogRead])
def get_exercise_logs(
    target_date: date | None = None, session: Session = Depends(get_session)
) -> List[ExerciseLog]:
    log_date = target_date or date.today()
    logs = session.exec(
        select(ExerciseLog)
        .where(ExerciseLog.log_date == log_date)
        .order_by(ExerciseLog.timestamp.desc())
    ).all()
    return logs


@app.post("/exercise-logs", response_model=ExerciseLogRead)
def create_exercise_log(
    payload: ExerciseLogCreate, session: Session = Depends(get_session)
) -> ExerciseLog:
    ts = payload.timestamp or datetime.utcnow()
    log = ExerciseLog(
        name=payload.name,
        calories_burned=payload.calories_burned,
        duration_minutes=payload.duration_minutes,
        timestamp=ts,
        log_date=ts.date(),
    )
    session.add(log)
    session.commit()
    session.refresh(log)
    return log


@app.delete("/exercise-logs/{log_id}")
def delete_exercise_log(log_id: int, session: Session = Depends(get_session)) -> dict:
    log = session.get(ExerciseLog, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Exercise log not found.")
    session.delete(log)
    session.commit()
    return {"status": "deleted", "id": log_id}


@app.get("/profile", response_model=UserProfileRead)
def get_profile(session: Session = Depends(get_session)) -> UserProfile:
    profile = session.exec(select(UserProfile).order_by(UserProfile.id)).first()
    if not profile:
        profile = UserProfile()
        session.add(profile)
        session.commit()
        session.refresh(profile)
    return profile


@app.put("/profile", response_model=UserProfileRead)
def upsert_profile(
    payload: UserProfileUpsert, session: Session = Depends(get_session)
) -> UserProfile:
    profile = session.exec(select(UserProfile).order_by(UserProfile.id)).first()
    if not profile:
        profile = UserProfile()
        session.add(profile)
    profile.age = payload.age
    profile.height_cm = payload.height_cm
    profile.weight_kg = payload.weight_kg
    profile.sex = payload.sex
    profile.activity_level = payload.activity_level
    profile.updated_at = datetime.utcnow()
    session.commit()
    session.refresh(profile)
    return profile


@app.get("/recents", response_model=List[RecentMeal])
def recents(session: Session = Depends(get_session)) -> List[RecentMeal]:
    statement = select(DailyLog).order_by(DailyLog.timestamp.desc())
    logs = session.exec(statement).all()
    seen = set()
    unique_logs: List[RecentMeal] = []
    for log in logs:
        key = log.food_name.strip().lower()
        if not key or key in seen:
            continue
        unique_logs.append(
            RecentMeal(
                food_name=log.food_name,
                calories=log.calories,
                protein=log.protein,
                carbs=log.carbs,
                fats=log.fats,
            )
        )
        seen.add(key)
        if len(unique_logs) >= 15:
            break
    return unique_logs


@app.get("/custom-foods", response_model=List[CustomFood])
def list_custom_foods(session: Session = Depends(get_session)) -> List[CustomFood]:
    return session.exec(select(CustomFood).order_by(CustomFood.name)).all()


@app.post("/custom-foods", response_model=CustomFood)
def create_custom_food(food: CustomFood, session: Session = Depends(get_session)) -> CustomFood:
    session.add(food)
    session.commit()
    session.refresh(food)
    return food


@app.delete("/custom-foods/{food_id}")
def delete_custom_food(food_id: int, session: Session = Depends(get_session)) -> dict:
    food = session.get(CustomFood, food_id)
    if not food:
        raise HTTPException(status_code=404, detail="Custom food not found.")
    session.delete(food)
    session.commit()
    return {"status": "deleted", "id": food_id}


@app.get("/food-items", response_model=List[FoodItemRead])
def list_food_items(
    favorites: bool | None = None, limit: int = 20, session: Session = Depends(get_session)
) -> List[FoodItemRead]:
    safe_limit = max(1, min(limit, 100))
    statement = select(FoodItem)
    if favorites is not None:
        statement = statement.where(FoodItem.is_favorite == favorites)
    statement = statement.order_by(FoodItem.created_at.desc()).limit(safe_limit * 3)
    items = session.exec(statement).all()
    if favorites is None:
        seen = set()
        deduped: list[FoodItem] = []
        for item in items:
            key = item.food_name.strip().lower()
            if key in seen:
                continue
            seen.add(key)
            deduped.append(item)
        items = deduped[:safe_limit]
    else:
        items = items[:safe_limit]
    return [
        FoodItemRead(
            id=item.id,
            food_name=item.food_name,
            calories=item.calories,
            protein=item.protein,
            carbs=item.carbs,
            fats=item.fats,
            source=item.source,
            barcode=item.barcode,
            brand=item.brand,
            serving_size=item.serving_size,
            is_favorite=item.is_favorite,
            created_at=item.created_at,
        )
        for item in items
    ]


@app.post("/food-items", response_model=FoodItemRead)
def create_food_item(
    payload: FoodItemCreate, session: Session = Depends(get_session)
) -> FoodItemRead:
    item = FoodItem(
        food_name=payload.food_name,
        calories=payload.calories,
        protein=payload.protein,
        carbs=payload.carbs,
        fats=payload.fats,
        source=payload.source,
        barcode=payload.barcode,
        brand=payload.brand,
        serving_size=payload.serving_size,
        is_favorite=payload.is_favorite,
    )
    session.add(item)
    session.commit()
    session.refresh(item)
    return FoodItemRead(
        id=item.id,
        food_name=item.food_name,
        calories=item.calories,
        protein=item.protein,
        carbs=item.carbs,
        fats=item.fats,
        source=item.source,
        barcode=item.barcode,
        brand=item.brand,
        serving_size=item.serving_size,
        is_favorite=item.is_favorite,
        created_at=item.created_at,
    )


@app.put("/food-items/{item_id}/favorite", response_model=FoodItemRead)
def update_food_favorite(
    item_id: int, payload: FoodItemFavorite, session: Session = Depends(get_session)
) -> FoodItemRead:
    item = session.get(FoodItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Food item not found.")
    item.is_favorite = payload.is_favorite
    session.add(item)
    session.commit()
    session.refresh(item)
    return FoodItemRead(
        id=item.id,
        food_name=item.food_name,
        calories=item.calories,
        protein=item.protein,
        carbs=item.carbs,
        fats=item.fats,
        source=item.source,
        barcode=item.barcode,
        brand=item.brand,
        serving_size=item.serving_size,
        is_favorite=item.is_favorite,
        created_at=item.created_at,
    )


@app.delete("/food-items/{item_id}")
def delete_food_item(item_id: int, session: Session = Depends(get_session)) -> dict:
    item = session.get(FoodItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Food item not found.")
    session.delete(item)
    session.commit()
    return {"status": "deleted", "id": item_id}


@app.get("/recipes", response_model=List[RecipeRead])
def list_recipes(session: Session = Depends(get_session)) -> List[RecipeRead]:
    statement = select(Recipe).order_by(Recipe.created_at.desc())
    recipes = session.exec(statement).all()
    return [_serialize_recipe(recipe) for recipe in recipes]


@app.post("/recipes", response_model=RecipeRead)
def create_recipe(payload: RecipeCreate, session: Session = Depends(get_session)) -> RecipeRead:
    servings = max(1, payload.servings or 1)
    ingredients = payload.ingredients or []
    if ingredients:
        total_calories = 0.0
        total_protein = 0.0
        total_carbs = 0.0
        total_fats = 0.0
        for item in ingredients:
            grams = item.grams if item.grams and item.grams > 0 else 100
            factor = grams / 100
            total_calories += item.calories * factor
            total_protein += item.protein * factor
            total_carbs += item.carbs * factor
            total_fats += item.fats * factor
        total_calories = float(total_calories)
    else:
        total_calories = int(payload.calories or 0)
        total_protein = float(payload.protein or 0)
        total_carbs = float(payload.carbs or 0)
        total_fats = float(payload.fats or 0)
    recipe = Recipe(
        name=payload.name,
        servings=servings,
        calories=int(round(total_calories)),
        protein=float(total_protein),
        carbs=float(total_carbs),
        fats=float(total_fats),
        ingredients_json=json.dumps([item.model_dump() for item in ingredients]),
    )
    session.add(recipe)
    session.commit()
    session.refresh(recipe)
    return _serialize_recipe(recipe)


@app.delete("/recipes/{recipe_id}")
def delete_recipe(recipe_id: int, session: Session = Depends(get_session)) -> dict:
    recipe = session.get(Recipe, recipe_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found.")
    session.delete(recipe)
    session.commit()
    return {"status": "deleted", "id": recipe_id}


@app.post("/analyze-photo", response_model=FoodEstimate)
async def analyze_photo(file: UploadFile = File(...)) -> FoodEstimate:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload an image file.")
    image_bytes = await file.read()
    try:
        return analyze_food_image(image_bytes, settings.gemini_api_key, settings.gemini_model)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Gemini analysis failed: {exc}") from exc


@app.get("/scan-barcode/{barcode_number}", response_model=BarcodeResult)
def scan_barcode(
    barcode_number: str, session: Session = Depends(get_session)
) -> BarcodeResult:
    if not barcode_number.isdigit() or len(barcode_number) not in {8, 12, 13, 14}:
        raise HTTPException(status_code=400, detail="Invalid barcode length.")
    try:
        result = fetch_barcode(barcode_number)
        try:
            item = FoodItem(
                food_name=result.food_name,
                calories=result.calories or 0,
                protein=result.protein or 0,
                carbs=result.carbs or 0,
                fats=result.fats or 0,
                source="Barcode",
                barcode=barcode_number,
                brand=result.brand,
                serving_size=result.serving_size,
            )
            session.add(item)
            session.commit()
        except Exception:
            session.rollback()
        return result
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Barcode lookup failed.") from exc


@app.get("/search-food", response_model=List[BarcodeResult])
def search_food(query: str) -> List[BarcodeResult]:
    query = query.strip()
    if len(query) < 2:
        raise HTTPException(status_code=400, detail="Query too short.")
    results: List[BarcodeResult] = []
    errors: list[Exception] = []
    usda_results: List[BarcodeResult] = []
    off_results: List[BarcodeResult] = []

    if settings.usda_api_key:
        try:
            usda_results = search_usda_foods(query, settings.usda_api_key)
        except Exception as exc:
            errors.append(exc)

    if not settings.usda_api_key or len(usda_results) < 5:
        try:
            off_results = search_foods(query)
        except Exception as exc:
            errors.append(exc)

    results.extend(usda_results)
    results.extend(off_results)

    if results:
        seen = set()
        deduped: List[BarcodeResult] = []
        for item in results:
            key = item.food_name.strip().lower()
            if key in seen:
                continue
            seen.add(key)
            deduped.append(item)
        return deduped[:20]

    if any(isinstance(err, TimeoutError) for err in errors):
        raise HTTPException(status_code=504, detail="Food search timed out. Try again.")
    if errors:
        raise HTTPException(status_code=502, detail="Food search failed.")
    return []
