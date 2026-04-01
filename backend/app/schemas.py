from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class DailyLogCreate(SQLModel):
    food_name: str
    source: str = "Manual"
    meal_slot: int = 1
    calories: int
    protein: float
    carbs: float
    fats: float
    grams: Optional[float] = None
    fiber: Optional[float] = None
    base_calories: Optional[int] = None
    base_protein: Optional[float] = None
    base_carbs: Optional[float] = None
    base_fats: Optional[float] = None
    timestamp: Optional[datetime] = None


class DailyLogRead(SQLModel):
    id: int
    timestamp: datetime
    food_name: str
    source: str
    meal_slot: int
    calories: int
    protein: float
    carbs: float
    fats: float
    grams: Optional[float] = None
    fiber: Optional[float] = None
    base_calories: Optional[int] = None
    base_protein: Optional[float] = None
    base_carbs: Optional[float] = None
    base_fats: Optional[float] = None


class DailySummary(SQLModel):
    date: str
    calories: int
    protein: float
    carbs: float
    fats: float


class FoodAnalysisItem(SQLModel):
    food_name: str
    calories: int
    protein: float
    carbs: float
    fats: float
    count: int


class FoodAnalysisResponse(SQLModel):
    top_calories: list[FoodAnalysisItem]
    top_protein: list[FoodAnalysisItem]


class RecentMeal(SQLModel):
    food_name: str
    calories: int
    protein: float
    carbs: float
    fats: float


class FoodEstimate(SQLModel):
    food_name: str
    calories: int
    protein: float
    carbs: float
    fats: float
    confidence: float
    notes: str = ""
    questions: list[str] = Field(default_factory=list)


class BarcodeResult(SQLModel):
    food_name: str
    calories: Optional[int] = None
    protein: Optional[float] = None
    carbs: Optional[float] = None
    fats: Optional[float] = None
    brand: Optional[str] = None
    serving_size: Optional[str] = None


class FoodItemCreate(SQLModel):
    food_name: str
    calories: int
    protein: float
    carbs: float
    fats: float
    source: str = "Manual"
    barcode: Optional[str] = None
    brand: Optional[str] = None
    serving_size: Optional[str] = None
    is_favorite: bool = False


class FoodItemRead(SQLModel):
    id: int
    food_name: str
    calories: int
    protein: float
    carbs: float
    fats: float
    source: str
    barcode: Optional[str] = None
    brand: Optional[str] = None
    serving_size: Optional[str] = None
    is_favorite: bool
    created_at: datetime


class FoodItemFavorite(SQLModel):
    is_favorite: bool


class RecipeIngredient(SQLModel):
    name: str
    calories: int
    protein: float
    carbs: float
    fats: float
    grams: float = 100


class RecipeCreate(SQLModel):
    name: str
    servings: int = 1
    ingredients: list[RecipeIngredient] = Field(default_factory=list)
    calories: Optional[int] = None
    protein: Optional[float] = None
    carbs: Optional[float] = None
    fats: Optional[float] = None


class RecipeRead(SQLModel):
    id: int
    name: str
    servings: int
    calories: int
    protein: float
    carbs: float
    fats: float
    ingredients: list[RecipeIngredient]
    created_at: datetime


class BulkLogRequest(SQLModel):
    meal: DailyLogCreate
    dates: list[date]


class MacroTargetUpsert(SQLModel):
    calories: int
    protein: float
    carbs: float
    fats: float
    meals_per_day: int = 3


class MacroTargetRead(SQLModel):
    id: int
    calories: int
    protein: float
    carbs: float
    fats: float
    meals_per_day: int
    updated_at: datetime


class WeightLogCreate(SQLModel):
    log_date: Optional[date] = None
    weight: float
    notes: Optional[str] = None


class WeightLogRead(SQLModel):
    id: int
    log_date: date
    weight: float
    notes: Optional[str] = None


class UserProfileUpsert(SQLModel):
    age: int
    height_cm: float
    weight_kg: float
    sex: str
    activity_level: str


class UserProfileRead(SQLModel):
    id: int
    age: int
    height_cm: float
    weight_kg: float
    sex: str
    activity_level: str
    updated_at: datetime


class WaterLogCreate(SQLModel):
    amount_ml: int
    timestamp: Optional[datetime] = None


class WaterLogRead(SQLModel):
    id: int
    timestamp: datetime
    amount_ml: int


class ExerciseLogCreate(SQLModel):
    name: str
    calories_burned: int = 0
    duration_minutes: Optional[int] = None
    timestamp: Optional[datetime] = None


class ExerciseLogRead(SQLModel):
    id: int
    timestamp: datetime
    log_date: date
    name: str
    calories_burned: int
    duration_minutes: Optional[int] = None
