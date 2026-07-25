import pandas as pd
import numpy as np
import os
import json
from typing import Optional, Dict, Any, List
from datetime import datetime

# Global in-memory datastore with disk persistence
_dataframe: Optional[pd.DataFrame] = None
_session_metadata: Optional[Dict[str, Any]] = None

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
SESSION_CSV_PATH = os.path.join(UPLOAD_DIR, "active_session.csv")
SESSION_META_PATH = os.path.join(UPLOAD_DIR, "active_session.json")

os.makedirs(UPLOAD_DIR, exist_ok=True)


def _load_from_disk():
    """Helper to auto-restore session dataframe and metadata from disk storage if memory was cleared."""
    global _dataframe, _session_metadata
    if _dataframe is not None and not _dataframe.empty:
        return

    if os.path.exists(SESSION_CSV_PATH):
        try:
            print(f"[Datastore] Restoring session from disk storage: {SESSION_CSV_PATH}")
            df = pd.read_csv(SESSION_CSV_PATH)
            if not df.empty:
                _dataframe = df
                if os.path.exists(SESSION_META_PATH):
                    with open(SESSION_META_PATH, "r", encoding="utf-8") as f:
                        _session_metadata = json.load(f)
                else:
                    _session_metadata = {
                        "active": True,
                        "filename": "stored_session.csv",
                        "rows": len(df),
                        "columns": list(df.columns),
                        "started_at": datetime.now().isoformat(),
                    }
        except Exception as e:
            print(f"[Datastore] Failed to restore session from disk: {e}")


def get_dataframe() -> Optional[pd.DataFrame]:
    """Return current session dataframe (restores from disk storage if needed)."""
    global _dataframe
    if _dataframe is None or _dataframe.empty:
        _load_from_disk()
    return _dataframe


def set_dataframe(df: pd.DataFrame, filename: str = "uploaded_file"):
    """Set active session dataframe and persist to disk storage."""
    global _dataframe, _session_metadata
    print(f"[Datastore] Starting active session for '{filename}' with {len(df)} rows")
    _dataframe = df
    _session_metadata = {
        "active": True,
        "filename": filename,
        "rows": len(df),
        "columns": list(df.columns),
        "started_at": datetime.now().isoformat(),
    }

    # Persist to disk storage
    try:
        df.to_csv(SESSION_CSV_PATH, index=False)
        with open(SESSION_META_PATH, "w", encoding="utf-8") as f:
            json.dump(_session_metadata, f, indent=2)
        print(f"[Datastore] Successfully persisted session to {SESSION_CSV_PATH}")
    except Exception as e:
        print(f"[Datastore] Could not persist session to disk: {e}")


def clear_dataframe():
    """Clear active session dataframe and remove disk storage files."""
    global _dataframe, _session_metadata
    print("[Datastore] Session ended — clearing dataframe and disk storage")
    _dataframe = None
    _session_metadata = None

    if os.path.exists(SESSION_CSV_PATH):
        try:
            os.remove(SESSION_CSV_PATH)
        except Exception:
            pass
    if os.path.exists(SESSION_META_PATH):
        try:
            os.remove(SESSION_META_PATH)
        except Exception:
            pass


def get_session_metadata() -> Dict[str, Any]:
    """Get active session metadata or inactive status."""
    global _session_metadata, _dataframe
    if _dataframe is None or _dataframe.empty:
        _load_from_disk()

    if _session_metadata and _dataframe is not None and not _dataframe.empty:
        return _session_metadata
    return {
        "active": False,
        "filename": "",
        "rows": 0,
        "columns": [],
        "started_at": None,
    }


def query_data(filters: Dict[str, Any] = None) -> pd.DataFrame:
    """Query data from current session dataframe. Returns empty DataFrame if no session active."""
    df = get_dataframe()
    if df is None or df.empty:
        return pd.DataFrame()

    if not filters:
        return df

    filtered_df = df.copy()
    if filters.get("location"):
        if "location" in filtered_df.columns:
            filtered_df = filtered_df[filtered_df["location"].isin(filters["location"])]
    if filters.get("cuisine"):
        if "cuisine" in filtered_df.columns:
            filtered_df = filtered_df[filtered_df["cuisine"].isin(filters["cuisine"])]
    if filters.get("min_rating"):
        if "rating" in filtered_df.columns:
            filtered_df = filtered_df[filtered_df["rating"] >= filters["min_rating"]]
    if filters.get("max_rating"):
        if "rating" in filtered_df.columns:
            filtered_df = filtered_df[filtered_df["rating"] <= filters["max_rating"]]
    if filters.get("min_revenue"):
        if "revenue" in filtered_df.columns:
            filtered_df = filtered_df[filtered_df["revenue"] >= filters["min_revenue"]]
    if filters.get("max_revenue"):
        if "revenue" in filtered_df.columns:
            filtered_df = filtered_df[filtered_df["revenue"] <= filters["max_revenue"]]

    return filtered_df


def get_unique_values(column: str) -> List:
    """Get unique values for a column in current session dataset."""
    df = get_dataframe()
    if df is None or df.empty or column not in df.columns:
        return []
    return sorted(df[column].unique().tolist())


from utils import sanitize_for_json

def get_dataset_schema() -> List[Dict[str, Any]]:
    """Get detailed schema information for current dataset columns."""
    df = get_dataframe()
    if df is None or df.empty:
        return []
    schema = []
    for col in df.columns:
        dtype = str(df[col].dtype)
        is_num = pd.api.types.is_numeric_dtype(df[col])
        non_null_count = int(df[col].notna().sum())
        sample_vals = df[col].dropna().unique()[:3].tolist()
        col_info = {
            "column": col,
            "data_type": dtype,
            "is_numeric": is_num,
            "non_null_count": non_null_count,
            "null_count": len(df) - non_null_count,
            "sample_values": [str(v) for v in sample_vals],
        }
        if is_num:
            col_info["min"] = float(df[col].min()) if not df[col].empty else 0
            col_info["max"] = float(df[col].max()) if not df[col].empty else 0
            col_info["mean"] = float(df[col].mean()) if not df[col].empty else 0
        schema.append(col_info)
    return sanitize_for_json(schema)


def get_paginated_rows(page: int = 1, limit: int = 50, search: str = "") -> Dict[str, Any]:
    """Get paginated data rows with optional search filter."""
    df = get_dataframe()
    if df is None or df.empty:
        return {"rows": [], "total": 0, "page": page, "pages": 0, "limit": limit}

    filtered_df = df
    if search:
        search_lower = search.lower()
        mask = pd.Series(False, index=df.index)
        for col in df.columns:
            mask = mask | df[col].astype(str).str.lower().str.contains(search_lower, na=False)
        filtered_df = df[mask]

    total_rows = len(filtered_df)
    total_pages = max(1, (total_rows + limit - 1) // limit)
    current_page = min(max(1, page), total_pages)

    start_idx = (current_page - 1) * limit
    end_idx = start_idx + limit
    page_df = filtered_df.iloc[start_idx:end_idx].copy()

    # Fill NaNs with None for clean JSON serialization
    page_df = page_df.where(pd.notnull(page_df), None)
    rows = page_df.to_dict(orient="records")

    res = {
        "rows": rows,
        "total": total_rows,
        "page": current_page,
        "pages": total_pages,
        "limit": limit,
        "columns": list(df.columns),
    }
    return sanitize_for_json(res)


