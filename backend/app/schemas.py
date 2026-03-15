from __future__ import annotations

from datetime import date, datetime
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


class DailySummary(SQLModel):
    date: str
    calories: int
    protein: float
    carbs: float
    fats: float


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
