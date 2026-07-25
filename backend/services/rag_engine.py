"""
RAG Engine for RevenueRadar
---------------------------
Chunks the uploaded DataFrame into semantic text segments,
indexes them with TF-IDF, and retrieves the most relevant
chunks for each user query to feed into the AI.
"""

import pandas as pd
import numpy as np
import json
from typing import List, Tuple, Optional
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


# ---------------------------------------------------------------------------
# Global RAG index (rebuilt whenever a new file is uploaded)
# ---------------------------------------------------------------------------
_chunks: List[str] = []
_vectorizer: Optional[TfidfVectorizer] = None
_chunk_matrix = None          # sparse TF-IDF matrix
_df_snapshot: Optional[pd.DataFrame] = None   # reference to indexed df


# ---------------------------------------------------------------------------
# Chunking helpers
# ---------------------------------------------------------------------------

def _chunk_overview(df: pd.DataFrame) -> str:
    """High-level dataset overview chunk."""
    cols = list(df.columns)
    numeric_cols = df.select_dtypes(include="number").columns.tolist()
    cat_cols = df.select_dtypes(include="object").columns.tolist()

    lines = [
        f"DATASET OVERVIEW",
        f"Total records: {len(df)}",
        f"Columns ({len(cols)}): {', '.join(cols)}",
        f"Numeric columns: {', '.join(numeric_cols)}",
        f"Categorical columns: {', '.join(cat_cols)}",
    ]

    if "revenue" in df.columns:
        lines += [
            f"Revenue — min: {df['revenue'].min():,.2f}, max: {df['revenue'].max():,.2f}, "
            f"mean: {df['revenue'].mean():,.2f}, median: {df['revenue'].median():,.2f}, "
            f"total: {df['revenue'].sum():,.2f}",
        ]

    # Date range
    for col in ["month", "date", "time", "year"]:
        if col in df.columns:
            try:
                vals = pd.to_datetime(df[col], errors="coerce").dropna()
                if len(vals):
                    lines.append(f"Date range: {vals.min().date()} to {vals.max().date()}")
                    break
            except Exception:
                pass

    return "\n".join(lines)


def _chunk_numeric_stats(df: pd.DataFrame) -> str:
    """Full descriptive statistics for numeric columns."""
    desc = df.describe().round(2)
    return f"NUMERIC STATISTICS\n{desc.to_string()}"


def _chunk_by_category(df: pd.DataFrame, col: str, agg_col: str = "revenue") -> List[str]:
    """One chunk per category value with aggregated metrics."""
    if col not in df.columns or agg_col not in df.columns:
        return []

    chunks = []
    grouped = df.groupby(col)
    summary = grouped[agg_col].agg(["sum", "mean", "count", "min", "max"]).round(2)
    summary = summary.sort_values("sum", ascending=False)

    # One combined chunk for category overview
    lines = [f"REVENUE BY {col.upper()}"]
    for cat, row in summary.iterrows():
        lines.append(
            f"{cat}: total={row['sum']:,.2f}, avg={row['mean']:,.2f}, "
            f"count={int(row['count'])}, min={row['min']:,.2f}, max={row['max']:,.2f}"
        )
    chunks.append("\n".join(lines))

    # Individual chunks for top 10 categories (for RAG precision)
    for cat, row in summary.head(10).iterrows():
        cat_df = df[df[col] == cat]
        extra_metrics = []
        for extra_col in ["rating", "marketing_budget", "service_quality_score", "avg_meal_price"]:
            if extra_col in cat_df.columns:
                extra_metrics.append(f"{extra_col}={cat_df[extra_col].mean():.2f}")
        chunk = (
            f"DETAIL — {col}: {cat}\n"
            f"Total {agg_col}: {row['sum']:,.2f}\n"
            f"Average {agg_col}: {row['mean']:,.2f}\n"
            f"Records: {int(row['count'])}\n"
            + (f"Other metrics: {', '.join(extra_metrics)}" if extra_metrics else "")
        )
        chunks.append(chunk)

    return chunks


def _chunk_time_series(df: pd.DataFrame) -> List[str]:
    """Monthly/temporal revenue trend chunks."""
    chunks = []
    for col in ["month", "date", "time"]:
        if col in df.columns and "revenue" in df.columns:
            try:
                temp = df.copy()
                temp["_period"] = pd.to_datetime(temp[col], errors="coerce").dt.to_period("M")
                monthly = temp.groupby("_period")["revenue"].agg(["sum", "mean", "count"]).round(2)
                monthly = monthly.sort_index()
                lines = ["TIME SERIES — Monthly Revenue"]
                for period, row in monthly.iterrows():
                    lines.append(
                        f"{period}: total={row['sum']:,.2f}, avg={row['mean']:,.2f}, count={int(row['count'])}"
                    )
                chunks.append("\n".join(lines))

                # Growth rates
                if len(monthly) >= 2:
                    sums = monthly["sum"].values
                    growth = np.diff(sums) / (sums[:-1] + 1e-9) * 100
                    periods = list(monthly.index)
                    growth_lines = ["MONTHLY REVENUE GROWTH RATES"]
                    for i, g in enumerate(growth):
                        growth_lines.append(f"{periods[i]} → {periods[i+1]}: {g:+.1f}%")
                    chunks.append("\n".join(growth_lines))
                break
            except Exception:
                pass
    return chunks


def _chunk_correlations(df: pd.DataFrame) -> str:
    """Correlation matrix chunk — key revenue drivers."""
    numeric = df.select_dtypes(include="number")
    if "revenue" not in numeric.columns or len(numeric.columns) < 2:
        return ""
    corr = numeric.corr()["revenue"].drop("revenue").sort_values(key=abs, ascending=False)
    lines = ["REVENUE CORRELATIONS (pearson r with revenue)"]
    for col, val in corr.items():
        strength = "strong" if abs(val) > 0.6 else "moderate" if abs(val) > 0.3 else "weak"
        direction = "positive" if val > 0 else "negative"
        lines.append(f"{col}: r={val:.3f} ({strength} {direction})")
    return "\n".join(lines)


def _chunk_top_records(df: pd.DataFrame) -> str:
    """Top and bottom 10 records by revenue."""
    if "revenue" not in df.columns:
        return ""
    sorted_df = df.sort_values("revenue", ascending=False)
    top = sorted_df.head(10)
    bottom = sorted_df.tail(10)
    return (
        f"TOP 10 RECORDS BY REVENUE\n{top.to_string(index=False)}\n\n"
        f"BOTTOM 10 RECORDS BY REVENUE\n{bottom.to_string(index=False)}"
    )


def _chunk_forecasting_context(df: pd.DataFrame) -> str:
    """Simple trend analysis for forecasting queries."""
    if "revenue" not in df.columns:
        return ""
    lines = ["FORECASTING CONTEXT"]

    # Overall trend from time series
    for col in ["month", "date", "time"]:
        if col in df.columns:
            try:
                temp = df.copy()
                temp["_period"] = pd.to_datetime(temp[col], errors="coerce").dt.to_period("M")
                monthly = temp.groupby("_period")["revenue"].sum().sort_index()
                if len(monthly) >= 3:
                    values = monthly.values
                    x = np.arange(len(values))
                    slope, intercept = np.polyfit(x, values, 1)
                    trend_dir = "upward" if slope > 0 else "downward"
                    lines.append(f"Revenue trend direction: {trend_dir}")
                    lines.append(f"Average monthly change: {slope:+,.2f}")
                    lines.append(f"Best month revenue: {values.max():,.2f}")
                    lines.append(f"Worst month revenue: {values.min():,.2f}")
                    lines.append(f"Revenue volatility (std): {values.std():,.2f}")
                    # Simple linear projection for next 3 months
                    next_1 = intercept + slope * len(values)
                    next_2 = intercept + slope * (len(values) + 1)
                    next_3 = intercept + slope * (len(values) + 2)
                    lines.append(f"Linear projection — next 3 months: {next_1:,.2f}, {next_2:,.2f}, {next_3:,.2f}")
                break
            except Exception:
                pass

    return "\n".join(lines)


def _chunk_sample_rows(df: pd.DataFrame, n: int = 20) -> str:
    """A representative sample of raw rows for context."""
    sample = df.sample(min(n, len(df)), random_state=42)
    return f"SAMPLE RECORDS ({n} rows)\n{sample.to_string(index=False)}"


# ---------------------------------------------------------------------------
# Build / Rebuild index
# ---------------------------------------------------------------------------

def build_rag_index(df: pd.DataFrame) -> int:
    """
    Build in-memory TF-IDF index from the DataFrame.
    Returns number of chunks indexed.
    """
    global _chunks, _vectorizer, _chunk_matrix, _df_snapshot

    all_chunks: List[str] = []

    # 1. Overview
    all_chunks.append(_chunk_overview(df))

    # 2. Numeric stats
    all_chunks.append(_chunk_numeric_stats(df))

    # 3. Category breakdowns
    for cat_col in ["location", "cuisine", "category", "region", "type", "product", "segment"]:
        if cat_col in df.columns:
            all_chunks.extend(_chunk_by_category(df, cat_col, "revenue"))

    # 4. Time series
    all_chunks.extend(_chunk_time_series(df))

    # 5. Correlations
    corr_chunk = _chunk_correlations(df)
    if corr_chunk:
        all_chunks.append(corr_chunk)

    # 6. Top/bottom records
    top_chunk = _chunk_top_records(df)
    if top_chunk:
        all_chunks.append(top_chunk)

    # 7. Forecasting context
    fc = _chunk_forecasting_context(df)
    if fc:
        all_chunks.append(fc)

    # 8. Sample rows
    all_chunks.append(_chunk_sample_rows(df))

    # Filter out empty chunks
    all_chunks = [c for c in all_chunks if c and c.strip()]

    # Build TF-IDF index
    _chunks = all_chunks
    _vectorizer = TfidfVectorizer(ngram_range=(1, 2), max_features=8000, stop_words="english")
    _chunk_matrix = _vectorizer.fit_transform(_chunks)
    _df_snapshot = df

    print(f"[RAG] Built index with {len(_chunks)} chunks from {len(df)} records")
    return len(_chunks)


# ---------------------------------------------------------------------------
# Retrieval
# ---------------------------------------------------------------------------

def retrieve_context(query: str, top_k: int = 6) -> str:
    """
    Retrieve the top-K most relevant chunks for the given query.
    Returns a single formatted context string.
    """
    global _chunks, _vectorizer, _chunk_matrix

    if not _chunks or _vectorizer is None or _chunk_matrix is None:
        return "No data indexed yet. Please upload a CSV or XML file first."

    # Vectorize the query
    q_vec = _vectorizer.transform([query])
    scores = cosine_similarity(q_vec, _chunk_matrix).flatten()
    top_indices = scores.argsort()[::-1][:top_k]

    # Always include the overview chunk (index 0) for grounding
    indices = list(top_indices)
    if 0 not in indices:
        indices = [0] + indices[: top_k - 1]

    retrieved = []
    for idx in indices:
        if 0 <= idx < len(_chunks):
            retrieved.append(f"--- CONTEXT BLOCK ---\n{_chunks[idx]}")

    return "\n\n".join(retrieved)


def has_index() -> bool:
    """Return True if the RAG index has been built."""
    return bool(_chunks) and _vectorizer is not None


def reset_rag_index():
    """Clear all RAG index chunks and memory state."""
    global _chunks, _vectorizer, _chunk_matrix, _df_snapshot
    _chunks = []
    _vectorizer = None
    _chunk_matrix = None
    _df_snapshot = None
    print("[RAG] Index cleared.")

