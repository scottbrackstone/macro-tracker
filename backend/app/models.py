from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class CustomFood(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    calories: int
    protein: float
    carbs: float
    fats: float


class DailyLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    timestamp: datetime = Field(default_factory=datetime.utcnow, index=True)
    food_name: str = Field(index=True)
    source: str = Field(default="Manual", index=True)
    meal_slot: int = Field(default=1, index=True)
    calories: int
    protein: float
    carbs: float
    fats: float


class MacroTarget(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    calories: int = 0
    protein: float = 0
    carbs: float = 0
    fats: float = 0
    meals_per_day: int = 3
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class WeightLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    log_date: date = Field(default_factory=date.today, index=True)
    weight: float
    notes: Optional[str] = None


class UserProfile(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    age: int = 0
    height_cm: float = 0
    weight_kg: float = 0
    sex: str = "unspecified"
    activity_level: str = "moderate"
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class FoodItem(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    food_name: str = Field(index=True)
    source: str = Field(default="Manual", index=True)
    barcode: Optional[str] = Field(default=None, index=True)
    brand: Optional[str] = None
    serving_size: Optional[str] = None
    calories: int
    protein: float
    carbs: float
    fats: float
    is_favorite: bool = Field(default=False, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class Recipe(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    servings: int = 1
    calories: int
    protein: float
    carbs: float
    fats: float
    ingredients_json: str = "[]"
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
