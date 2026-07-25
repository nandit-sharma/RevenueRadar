import asyncio
import os
import pandas as pd
from services.datastore import set_dataframe, get_dataframe, get_dataset_schema, get_paginated_rows
from services.smart_analyst import analyze_dataset_query
from services.rag_engine import build_rag_index

def test_backend():
    print("1. Testing Datastore & Smart Analyst...")
    sample_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "sample_data.csv")
    if os.path.exists(sample_path):
        df = pd.read_csv(sample_path)
        set_dataframe(df, "sample_data.csv")
        build_rag_index(df)

        print(f"Loaded dataframe with {len(df)} rows and {len(df.columns)} columns.")

        schema = get_dataset_schema()
        print(f"Schema columns count: {len(schema)}")

        paginated = get_paginated_rows(page=1, limit=5, search="")
        print(f"Paginated rows returned: {len(paginated['rows'])}, total: {paginated['total']}")

        print("\n2. Testing Natural Language Queries with Smart Analyst...")
        queries = [
            "Which category drives the most revenue?",
            "Predict revenue for next quarter based on trends",
            "What factors correlate most with revenue?",
            "Bottom performers by revenue",
            "General executive performance summary"
        ]

        for q in queries:
            res = analyze_dataset_query(q, df)
            print(f"\n--- Query: '{q}' ---")
            print("Confidence:", res.get("confidence"))
            print("Key Insight:", res.get("key_insight"))
            print("Predictions present:", bool(res.get("predictions")))
            print("SQL present:", bool(res.get("sql")))
            print("Data rows returned:", len(res.get("data") or []))
            print("Answer preview:", res.get("answer")[:150].replace("\n", " "))
    else:
        print("sample_data.csv not found at", sample_path)

if __name__ == '__main__':
    test_backend()
