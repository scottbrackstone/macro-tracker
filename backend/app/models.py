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
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class WeightLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    date: date = Field(default_factory=date.today, index=True)
    weight: float
    notes: Optional[str] = None
