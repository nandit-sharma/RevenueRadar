from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List
import pandas as pd
import numpy as np
from services.datastore import get_dataframe
from datetime import datetime

router = APIRouter()

_alerts = []

class AlertCreate(BaseModel):
    name: str
    metric: str
    threshold: float
    condition: str  # "above" or "below"
    notification_type: str = "dashboard"

@router.get("/alerts")
def get_alerts():
    df = get_dataframe()
    if df is None or df.empty:
        return {
            "auto_detected": [],
            "custom": _alerts
        }

    auto_alerts = detect_anomalies(df)
    return {
        "auto_detected": auto_alerts,
        "custom": _alerts
    }

@router.post("/alerts/create")
def create_alert(alert: AlertCreate):
    new_alert = {
        "id": len(_alerts) + 1,
        "created_at": datetime.now().isoformat(),
        **alert.dict()
    }
    _alerts.append(new_alert)
    return {"success": True, "alert": new_alert}

def detect_anomalies(df: pd.DataFrame) -> List[dict]:
    alerts = []
    if df is None or df.empty:
        return alerts

    if 'revenue' in df.columns and 'month' in df.columns:
        monthly = df.groupby('month')['revenue'].sum().sort_index()

        if len(monthly) >= 3:
            rolling_mean = monthly.rolling(3).mean()
            rolling_std = monthly.rolling(3).std()

            for i, (month, rev) in enumerate(monthly.items()):
                if i < 2:
                    continue
                mean = rolling_mean.iloc[i]
                std = rolling_std.iloc[i]
                if std > 0:
                    z = (rev - mean) / std
                    if z < -1.5:
                        alerts.append({
                            "type": "revenue_drop",
                            "severity": "high" if z < -2 else "medium",
                            "message": f"Revenue dropped significantly in {month} (${rev:,.0f} vs avg ${mean:,.0f})",
                            "month": str(month),
                            "value": round(float(rev), 2),
                            "expected": round(float(mean), 2)
                        })
                    elif z > 1.5:
                        alerts.append({
                            "type": "revenue_spike",
                            "severity": "low",
                            "message": f"Revenue spike detected in {month} (${rev:,.0f} vs avg ${mean:,.0f})",
                            "month": str(month),
                            "value": round(float(rev), 2),
                            "expected": round(float(mean), 2)
                        })

    if 'location' in df.columns and 'revenue' in df.columns:
        loc_revenue = df.groupby('location')['revenue'].sum()
        overall_avg = loc_revenue.mean()
        for loc, rev in loc_revenue.items():
            if rev < overall_avg * 0.5:
                alerts.append({
                    "type": "underperforming_location",
                    "severity": "medium",
                    "message": f"{loc} revenue (${rev:,.0f}) is significantly below average (${overall_avg:,.0f})",
                    "location": str(loc),
                    "value": round(float(rev), 2),
                    "expected": round(float(overall_avg), 2)
                })

    if 'weekend_reservations' in df.columns:
        avg_res = df['weekend_reservations'].mean()
        low_res = df[df['weekend_reservations'] < avg_res * 0.4]
        if len(low_res) > 0:
            alerts.append({
                "type": "low_reservations",
                "severity": "medium",
                "message": f"{len(low_res)} units have critically low weekend reservations",
                "count": len(low_res),
                "threshold": round(float(avg_res * 0.4), 0)
            })

    return alerts[:10]
