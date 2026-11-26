from datetime import datetime, timezone
from math import ceil

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="GoodTable Forecast Service", version="1.0.0")


class ForecastRequest(BaseModel):
    prepared_servings: int = Field(gt=0, le=10000)
    expected_demand: int = Field(ge=0, le=10000)
    available_until: datetime


class ForecastResponse(BaseModel):
    predicted_surplus: int
    confidence: float
    recommended_pickup_minutes: int


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/predict", response_model=ForecastResponse)
def predict(request: ForecastRequest):
    available_until = request.available_until
    if available_until.tzinfo is None:
        available_until = available_until.replace(tzinfo=timezone.utc)

    minutes_remaining = (available_until - datetime.now(timezone.utc)).total_seconds() / 60
    if minutes_remaining <= 0:
        raise HTTPException(status_code=422, detail="Food availability must end in the future")

    surplus = max(0, request.prepared_servings - request.expected_demand)
    if surplus == 0:
        return ForecastResponse(
            predicted_surplus=0,
            confidence=0.9,
            recommended_pickup_minutes=max(5, min(60, ceil(minutes_remaining / 3))),
        )

    demand_ratio = request.expected_demand / request.prepared_servings
    confidence = round(min(0.95, max(0.55, 0.65 + abs(0.5 - demand_ratio) * 0.5)), 2)
    pickup_window = max(5, min(60, ceil(minutes_remaining / 3)))
    return ForecastResponse(
        predicted_surplus=surplus,
        confidence=confidence,
        recommended_pickup_minutes=pickup_window,
    )
