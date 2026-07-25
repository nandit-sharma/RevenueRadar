from fastapi import APIRouter
import pandas as pd
import numpy as np
from services.datastore import query_data

router = APIRouter()

@router.get("/forecast")
def get_forecast(periods: int = 6):
    df = query_data()

    if df is None or df.empty or 'month' not in df.columns or 'revenue' not in df.columns:
        return {
            "actual": [],
            "forecast": [],
            "summary": {
                "total_forecast_revenue": 0,
                "avg_monthly_forecast": 0,
                "projected_growth_pct": 0,
                "periods": periods
            }
        }

    monthly = (
        df.groupby('month')['revenue']
        .sum()
        .sort_index()
        .reset_index()
    )
    monthly.columns = ['month', 'revenue']

    if len(monthly) == 0:
        return {
            "actual": [],
            "forecast": [],
            "summary": {
                "total_forecast_revenue": 0,
                "avg_monthly_forecast": 0,
                "projected_growth_pct": 0,
                "periods": periods
            }
        }

    # Simple linear regression forecast
    n = len(monthly)
    x = np.arange(n)
    y = monthly['revenue'].values

    if n >= 3:
        coeffs = np.polyfit(x, y, deg=min(2, n - 1))
        poly = np.poly1d(coeffs)
    else:
        coeffs = np.polyfit(x, y, 1)
        poly = np.poly1d(coeffs)

    # Generate forecast dates
    try:
        last_month = pd.to_datetime(monthly['month'].iloc[-1])
        forecast_months = pd.date_range(last_month, periods=periods + 1, freq='MS')[1:]
    except Exception:
        forecast_months = [f"Month {i+1}" for i in range(periods)]

    forecast_values = [max(0, float(poly(n + i))) for i in range(periods)]

    ci_upper = [v * 1.1 for v in forecast_values]
    ci_lower = [v * 0.9 for v in forecast_values]

    forecast_data = [
        {
            "month": d.strftime("%Y-%m-%d") if hasattr(d, 'strftime') else str(d),
            "revenue": round(v, 2),
            "upper": round(u, 2),
            "lower": round(l, 2),
            "type": "forecast"
        }
        for d, v, u, l in zip(forecast_months, forecast_values, ci_upper, ci_lower)
    ]

    actual_data = [
        {
            "month": str(row['month']),
            "revenue": round(float(row['revenue']), 2),
            "type": "actual"
        }
        for _, row in monthly.iterrows()
    ]

    total_forecast = sum(forecast_values)
    avg_actual = monthly['revenue'].mean()
    growth_pct = round(((total_forecast / periods - avg_actual) / avg_actual) * 100, 2) if avg_actual else 0

    return {
        "actual": actual_data,
        "forecast": forecast_data,
        "summary": {
            "total_forecast_revenue": round(total_forecast, 2),
            "avg_monthly_forecast": round(total_forecast / periods, 2),
            "projected_growth_pct": growth_pct,
            "periods": periods
        }
    }
