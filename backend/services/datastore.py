import pandas as pd
import numpy as np
import json
from typing import Optional, Dict, Any, List
from config import USE_MOCK_DATA, GCP_PROJECT_ID, BIGQUERY_DATASET, BIGQUERY_TABLE

# Global in-memory datastore
_dataframe: Optional[pd.DataFrame] = None

def generate_mock_data() -> pd.DataFrame:
    """Generate realistic restaurant revenue mock data."""
    np.random.seed(42)
    n = 200

    locations = ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix",
                 "Philadelphia", "San Antonio", "San Diego", "Dallas", "Austin"]
    cuisines = ["Italian", "Mexican", "Chinese", "Indian", "American",
                "Japanese", "Thai", "Mediterranean", "French", "Korean"]
    names = [
        "The Golden Fork", "Spice Garden", "Urban Bites", "Harvest Table",
        "Blue Ocean Grill", "Fire & Smoke", "Casa Bella", "Sakura House",
        "The Curry Leaf", "Noodle Palace", "Bistro Moderne", "The Steakhouse",
        "Green Plate", "Mama Mia", "Dragon Palace", "Sunset Diner",
        "The Rustic Kitchen", "Coastal Eats", "Mountain View Cafe", "City Flavors"
    ]

    months = pd.date_range("2023-01-01", periods=12, freq="MS")

    rows = []
    for i in range(n):
        name = np.random.choice(names)
        location = np.random.choice(locations)
        cuisine = np.random.choice(cuisines)
        base_revenue = np.random.uniform(50000, 500000)
        month = np.random.choice(months)

        # Seasonal multiplier
        month_num = month.month
        seasonal = 1.0 + 0.2 * np.sin((month_num - 3) * np.pi / 6)

        marketing = np.random.uniform(1000, 20000)
        followers = np.random.randint(500, 50000)
        rating = np.random.uniform(3.0, 5.0)
        service = np.random.uniform(6.0, 10.0)
        seating = np.random.randint(20, 200)
        avg_price = np.random.uniform(10, 80)
        chef_exp = np.random.randint(1, 25)
        num_reviews = np.random.randint(50, 2000)
        avg_review_len = np.random.randint(50, 300)
        ambience = np.random.uniform(5.0, 10.0)
        parking = np.random.choice([True, False])
        weekend_res = np.random.randint(50, 500)
        weekday_res = np.random.randint(20, 300)

        # Revenue influenced by factors
        revenue = (base_revenue * seasonal
                   + marketing * 8
                   + followers * 2
                   + rating * 10000
                   + service * 5000
                   + np.random.normal(0, 10000))
        revenue = max(10000, revenue)

        rows.append({
            "name": name,
            "location": location,
            "cuisine": cuisine,
            "rating": round(rating, 2),
            "seating_capacity": seating,
            "avg_meal_price": round(avg_price, 2),
            "marketing_budget": round(marketing, 2),
            "social_media_followers": followers,
            "chef_experience_years": chef_exp,
            "num_reviews": num_reviews,
            "avg_review_length": avg_review_len,
            "ambience_score": round(ambience, 2),
            "service_quality_score": round(service, 2),
            "parking_availability": parking,
            "weekend_reservations": weekend_res,
            "weekday_reservations": weekday_res,
            "revenue": round(revenue, 2),
            "month": month.strftime("%Y-%m-%d"),
            "year": month.year,
            "month_num": month.month,
        })

    return pd.DataFrame(rows)


def get_dataframe() -> pd.DataFrame:
    global _dataframe
    if _dataframe is None:
        _dataframe = generate_mock_data()
    return _dataframe


def set_dataframe(df: pd.DataFrame):
    global _dataframe
    _dataframe = df


def query_data(filters: Dict[str, Any] = None) -> pd.DataFrame:
    df = get_dataframe()
    if not filters:
        return df

    if filters.get("location"):
        df = df[df["location"].isin(filters["location"])]
    if filters.get("cuisine"):
        df = df[df["cuisine"].isin(filters["cuisine"])]
    if filters.get("min_rating"):
        df = df[df["rating"] >= filters["min_rating"]]
    if filters.get("max_rating"):
        df = df[df["rating"] <= filters["max_rating"]]
    if filters.get("min_revenue"):
        df = df[df["revenue"] >= filters["min_revenue"]]
    if filters.get("max_revenue"):
        df = df[df["revenue"] <= filters["max_revenue"]]

    return df


def get_unique_values(column: str) -> List:
    df = get_dataframe()
    return sorted(df[column].unique().tolist())
