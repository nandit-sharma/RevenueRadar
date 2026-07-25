from fastapi import APIRouter, Query
from typing import List, Optional
import pandas as pd
from services.datastore import query_data, get_unique_values

from utils import sanitize_for_json

router = APIRouter()

def parse_list(val: Optional[str]) -> Optional[List[str]]:
    if not val:
        return None
    return [v.strip() for v in val.split(',') if v.strip()]

@router.get("/kpis")
def get_kpis(
    location: Optional[str] = None,
    cuisine: Optional[str] = None,
    min_rating: Optional[float] = None,
    max_rating: Optional[float] = None,
):
    filters = {}
    if location:
        filters["location"] = parse_list(location)
    if cuisine:
        filters["cuisine"] = parse_list(cuisine)
    if min_rating:
        filters["min_rating"] = min_rating
    if max_rating:
        filters["max_rating"] = max_rating

    df = query_data(filters)
    if df is None or df.empty:
        return {
            "total_revenue": 0,
            "avg_rating": 0,
            "avg_service_quality": 0,
            "best_cuisine": "N/A",
            "best_location": "N/A",
            "total_records": 0,
            "avg_revenue": 0,
            "mom_growth": None,
        }

    total_revenue = df['revenue'].sum() if 'revenue' in df.columns else 0
    avg_rating = df['rating'].mean() if 'rating' in df.columns else 0
    avg_service = df['service_quality_score'].mean() if 'service_quality_score' in df.columns else 0

    best_cuisine = "N/A"
    if 'cuisine' in df.columns and len(df) > 0:
        cuis_sums = df.groupby('cuisine')['revenue'].sum()
        if not cuis_sums.empty:
            best_cuisine = str(cuis_sums.idxmax())

    best_location = "N/A"
    if 'location' in df.columns and len(df) > 0:
        loc_sums = df.groupby('location')['revenue'].sum()
        if not loc_sums.empty:
            best_location = str(loc_sums.idxmax())

    total_records = len(df)
    avg_revenue = df['revenue'].mean() if 'revenue' in df.columns and len(df) > 0 else 0

    # MoM growth if month data available
    mom_growth = None
    if 'month' in df.columns:
        monthly = df.groupby('month')['revenue'].sum().sort_index()
        if len(monthly) >= 2:
            prev = float(monthly.iloc[-2])
            curr = float(monthly.iloc[-1])
            if prev != 0:
                calc = ((curr - prev) / prev) * 100
                mom_growth = round(float(calc), 2) if not pd.isna(calc) else 0

    return sanitize_for_json({
        "total_revenue": round(float(total_revenue), 2),
        "avg_rating": round(float(avg_rating), 2),
        "avg_service_quality": round(float(avg_service), 2),
        "best_cuisine": str(best_cuisine),
        "best_location": str(best_location),
        "total_records": total_records,
        "avg_revenue": round(float(avg_revenue), 2),
        "mom_growth": mom_growth,
    })


@router.get("/revenue-by-location")
def revenue_by_location(
    location: Optional[str] = None,
    cuisine: Optional[str] = None,
):
    filters = {}
    if location:
        filters["location"] = parse_list(location)
    if cuisine:
        filters["cuisine"] = parse_list(cuisine)

    df = query_data(filters)
    if df is None or df.empty or 'location' not in df.columns or 'revenue' not in df.columns:
        return []

    result = (
        df.groupby('location')['revenue']
        .sum()
        .sort_values(ascending=False)
        .reset_index()
    )
    result.columns = ['location', 'revenue']
    return sanitize_for_json(result.to_dict(orient='records'))

@router.get("/revenue-by-cuisine")
def revenue_by_cuisine(
    location: Optional[str] = None,
    cuisine: Optional[str] = None,
):
    filters = {}
    if location:
        filters["location"] = parse_list(location)
    if cuisine:
        filters["cuisine"] = parse_list(cuisine)

    df = query_data(filters)
    if df is None or df.empty or 'cuisine' not in df.columns or 'revenue' not in df.columns:
        return []

    result = (
        df.groupby('cuisine')['revenue']
        .sum()
        .sort_values(ascending=False)
        .reset_index()
    )
    result.columns = ['cuisine', 'revenue']
    return sanitize_for_json(result.to_dict(orient='records'))

@router.get("/revenue-trend")
def revenue_trend(
    location: Optional[str] = None,
    cuisine: Optional[str] = None,
):
    filters = {}
    if location:
        filters["location"] = parse_list(location)
    if cuisine:
        filters["cuisine"] = parse_list(cuisine)

    df = query_data(filters)
    if df is None or df.empty or 'month' not in df.columns or 'revenue' not in df.columns:
        return []

    result = (
        df.groupby('month')['revenue']
        .sum()
        .sort_index()
        .reset_index()
    )
    result.columns = ['month', 'revenue']
    return sanitize_for_json(result.to_dict(orient='records'))

@router.get("/top-entities")
def top_entities(
    limit: int = 10,
    location: Optional[str] = None,
    cuisine: Optional[str] = None,
):
    filters = {}
    if location:
        filters["location"] = parse_list(location)
    if cuisine:
        filters["cuisine"] = parse_list(cuisine)

    df = query_data(filters)
    if df is None or df.empty or 'revenue' not in df.columns:
        return []

    name_col = 'name' if 'name' in df.columns else df.columns[0]

    cols = [name_col, 'revenue']
    for c in ['location', 'cuisine', 'rating', 'service_quality_score', 'marketing_budget']:
        if c in df.columns:
            cols.append(c)

    result = (
        df[cols]
        .groupby([name_col] + [c for c in cols[2:] if c in df.columns])
        .agg({'revenue': 'sum'})
        .reset_index()
        .sort_values('revenue', ascending=False)
        .head(limit)
    )
    return sanitize_for_json(result.to_dict(orient='records'))

@router.get("/filters/options")
def filter_options():
    return sanitize_for_json({
        "locations": get_unique_values('location'),
        "cuisines": get_unique_values('cuisine'),
    })

