from fastapi import APIRouter
from typing import Optional
import pandas as pd
import numpy as np
from services.datastore import query_data

router = APIRouter()

@router.get("/correlation")
def get_correlation(location: Optional[str] = None, cuisine: Optional[str] = None):
    df = query_data()
    numeric_cols = df.select_dtypes(include='number').columns.tolist()

    # Focus on key columns
    key_cols = ['revenue', 'rating', 'marketing_budget', 'social_media_followers',
                'service_quality_score', 'ambience_score', 'num_reviews',
                'avg_meal_price', 'seating_capacity', 'chef_experience_years',
                'weekend_reservations', 'weekday_reservations']
    cols = [c for c in key_cols if c in numeric_cols]
    corr = df[cols].corr().round(3)

    return {
        "columns": cols,
        "matrix": corr.to_dict()
    }

@router.get("/drivers")
def get_drivers():
    df = query_data()
    numeric_cols = df.select_dtypes(include='number').columns.tolist()
    if 'revenue' not in numeric_cols:
        return []

    feature_cols = [c for c in numeric_cols if c != 'revenue' and c not in ['year', 'month_num']]
    correlations = df[feature_cols + ['revenue']].corr()['revenue'].drop('revenue')
    correlations = correlations.abs().sort_values(ascending=False)

    result = []
    for feat, corr_val in correlations.items():
        direction = "positive" if df[feat].corr(df['revenue']) > 0 else "negative"
        result.append({
            "feature": feat,
            "correlation": round(float(corr_val), 3),
            "direction": direction,
            "impact": "High" if corr_val > 0.5 else "Medium" if corr_val > 0.3 else "Low"
        })

    return result[:10]

@router.get("/seasonal-patterns")
def get_seasonal_patterns():
    df = query_data()
    if 'month_num' not in df.columns:
        return []

    month_names = {1: 'Jan', 2: 'Feb', 3: 'Mar', 4: 'Apr', 5: 'May', 6: 'Jun',
                   7: 'Jul', 8: 'Aug', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dec'}

    result = (
        df.groupby('month_num')['revenue']
        .mean()
        .reset_index()
    )
    result['month_name'] = result['month_num'].map(month_names)
    result['revenue'] = result['revenue'].round(2)
    return result[['month_name', 'revenue']].to_dict(orient='records')
