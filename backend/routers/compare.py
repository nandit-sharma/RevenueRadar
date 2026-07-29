"""
Compare router — side-by-side comparison of two uploaded datasets.
Accepts two files (old + new), a gap label (1m / 3m / 1yr),
and returns computed diff metrics plus an AI-generated conclusion.
"""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional
import pandas as pd
import numpy as np
import os
import io
import asyncio

from utils import sanitize_for_json

router = APIRouter()


# ---------------------------------------------------------------------------
# Reuse upload parsing helpers (import from upload module)
# ---------------------------------------------------------------------------

def _import_parse_helpers():
    from routers.upload import _parse_csv, _parse_xml, clean_dataframe
    return _parse_csv, _parse_xml, clean_dataframe


def _parse_file(content: bytes, filename: str) -> pd.DataFrame:
    _parse_csv, _parse_xml, clean_dataframe = _import_parse_helpers()
    fname = (filename or '').lower()
    if fname.endswith('.xml'):
        df = _parse_xml(content)
    else:
        df = _parse_csv(content)
    return clean_dataframe(df)


# ---------------------------------------------------------------------------
# Comparison helpers
# ---------------------------------------------------------------------------

def _safe_float(val) -> float:
    try:
        v = float(val)
        return 0.0 if (np.isnan(v) or np.isinf(v)) else v
    except Exception:
        return 0.0


def _compute_metrics(df: pd.DataFrame) -> dict:
    """Extract key aggregated metrics from a cleaned dataframe."""
    rev = df['revenue'].sum() if 'revenue' in df.columns else 0.0
    avg_rev = df['revenue'].mean() if 'revenue' in df.columns else 0.0
    avg_rating = df['rating'].mean() if 'rating' in df.columns else None

    by_location = []
    if 'location' in df.columns and 'revenue' in df.columns:
        grp = df.groupby('location')['revenue'].sum().sort_values(ascending=False).reset_index()
        grp.columns = ['location', 'revenue']
        by_location = sanitize_for_json(grp.head(15).to_dict(orient='records'))

    by_category = []
    if 'cuisine' in df.columns and 'revenue' in df.columns:
        grp = df.groupby('cuisine')['revenue'].sum().sort_values(ascending=False).reset_index()
        grp.columns = ['category', 'revenue']
        by_category = sanitize_for_json(grp.head(15).to_dict(orient='records'))

    name_col = 'name' if 'name' in df.columns else (df.columns[0] if len(df.columns) > 0 else None)
    top_entities = []
    if name_col and 'revenue' in df.columns:
        grp = df.groupby(name_col)['revenue'].sum().sort_values(ascending=False).head(10).reset_index()
        grp.columns = ['name', 'revenue']
        top_entities = sanitize_for_json(grp.to_dict(orient='records'))

    return {
        'total_revenue': _safe_float(rev),
        'avg_revenue': _safe_float(avg_rev),
        'avg_rating': _safe_float(avg_rating) if avg_rating is not None else None,
        'record_count': int(len(df)),
        'by_location': by_location,
        'by_category': by_category,
        'top_entities': top_entities,
    }


def _pct_change(old: float, new: float) -> Optional[float]:
    if old == 0:
        return None
    return round(((new - old) / old) * 100, 2)


def _build_comparison(old_m: dict, new_m: dict, gap: str) -> dict:
    """Build a structured comparison dict from two metric snapshots."""
    rev_change = _pct_change(old_m['total_revenue'], new_m['total_revenue'])
    avg_change = _pct_change(old_m['avg_revenue'], new_m['avg_revenue'])
    records_change = _pct_change(old_m['record_count'], new_m['record_count'])

    # Location comparison — join old & new
    old_loc = {r['location']: r['revenue'] for r in old_m['by_location']}
    new_loc = {r['location']: r['revenue'] for r in new_m['by_location']}
    all_locs = sorted(set(old_loc) | set(new_loc))
    by_location_diff = []
    for loc in all_locs:
        o = _safe_float(old_loc.get(loc, 0))
        n = _safe_float(new_loc.get(loc, 0))
        by_location_diff.append({'location': loc, 'old': o, 'new': n, 'change_pct': _pct_change(o, n)})
    by_location_diff.sort(key=lambda x: x['new'], reverse=True)

    # Category comparison
    old_cat = {r['category']: r['revenue'] for r in old_m['by_category']}
    new_cat = {r['category']: r['revenue'] for r in new_m['by_category']}
    all_cats = sorted(set(old_cat) | set(new_cat))
    by_category_diff = []
    for cat in all_cats:
        o = _safe_float(old_cat.get(cat, 0))
        n = _safe_float(new_cat.get(cat, 0))
        by_category_diff.append({'category': cat, 'old': o, 'new': n, 'change_pct': _pct_change(o, n)})
    by_category_diff.sort(key=lambda x: x['new'], reverse=True)

    return {
        'gap': gap,
        'summary': {
            'total_revenue_old': old_m['total_revenue'],
            'total_revenue_new': new_m['total_revenue'],
            'revenue_change_pct': rev_change,
            'avg_revenue_old': old_m['avg_revenue'],
            'avg_revenue_new': new_m['avg_revenue'],
            'avg_revenue_change_pct': avg_change,
            'records_old': old_m['record_count'],
            'records_new': new_m['record_count'],
            'records_change_pct': records_change,
            'avg_rating_old': old_m['avg_rating'],
            'avg_rating_new': new_m['avg_rating'],
        },
        'by_location': by_location_diff[:15],
        'by_category': by_category_diff[:15],
        'top_old': old_m['top_entities'],
        'top_new': new_m['top_entities'],
    }


# ---------------------------------------------------------------------------
# AI conclusion generator (Gemini → fallback rule-based)
# ---------------------------------------------------------------------------

async def _generate_conclusion(comparison: dict) -> str:
    """Call Gemini to write a plain-English conclusion. Falls back to rule-based."""
    try:
        return await _call_gemini_conclusion(comparison)
    except Exception:
        pass
    return _rule_based_conclusion(comparison)


def _rule_based_conclusion(comparison: dict) -> str:
    s = comparison['summary']
    gap_label = {'1m': '1 month', '3m': '3 months', '1yr': '1 year'}.get(comparison['gap'], comparison['gap'])

    old_rev = s['total_revenue_old']
    new_rev = s['total_revenue_new']
    chg = s['revenue_change_pct']

    direction = "increased" if new_rev > old_rev else ("decreased" if new_rev < old_rev else "remained unchanged")
    trend_emoji = "📈" if new_rev > old_rev else ("📉" if new_rev < old_rev else "➡️")

    lines = [
        f"## {trend_emoji} {gap_label} Comparison — Executive Summary",
        "",
        f"Over the selected **{gap_label}** period, total revenue has **{direction}** from "
        f"${old_rev:,.0f} to ${new_rev:,.0f}"
        + (f" ({'+' if chg and chg > 0 else ''}{chg:.1f}%)" if chg is not None else "") + ".",
        "",
    ]

    # Top movers by location
    winners = [r for r in comparison['by_location'] if r.get('change_pct') and r['change_pct'] > 10]
    losers = [r for r in comparison['by_location'] if r.get('change_pct') and r['change_pct'] < -10]

    if winners:
        lines.append("### 🏆 Top Growing Locations")
        for r in winners[:3]:
            lines.append(f"- **{r['location']}**: +{r['change_pct']:.1f}% (${r['new']:,.0f})")

    if losers:
        lines.append("")
        lines.append("### ⚠️ Declining Locations")
        for r in losers[:3]:
            lines.append(f"- **{r['location']}**: {r['change_pct']:.1f}% (${r['new']:,.0f})")

    # Top movers by category
    cat_winners = [r for r in comparison['by_category'] if r.get('change_pct') and r['change_pct'] > 10]
    cat_losers = [r for r in comparison['by_category'] if r.get('change_pct') and r['change_pct'] < -10]

    if cat_winners:
        lines.append("")
        lines.append("### 📦 Fastest Growing Categories")
        for r in cat_winners[:3]:
            lines.append(f"- **{r['category']}**: +{r['change_pct']:.1f}% (${r['new']:,.0f})")

    if cat_losers:
        lines.append("")
        lines.append("### 📦 Declining Categories")
        for r in cat_losers[:3]:
            lines.append(f"- **{r['category']}**: {r['change_pct']:.1f}% (${r['new']:,.0f})")

    lines.append("")
    lines.append("### 💡 Recommendation")
    if new_rev > old_rev:
        lines.append(
            f"Revenue growth is positive. Focus on replicating the strategies of your top-growing segments, "
            f"and investigate if the declining locations need operational improvements or targeted promotions."
        )
    else:
        lines.append(
            f"Revenue has declined. Conduct a root-cause analysis on underperforming locations and categories. "
            f"Consider pricing adjustments, marketing campaigns, or product mix changes to reverse the trend."
        )

    return "\n".join(lines)


async def _call_gemini_conclusion(comparison: dict) -> str:
    """Use Google Gemini to generate a rich markdown conclusion."""
    api_key = os.getenv("GOOGLE_API_KEY", "")
    if not api_key:
        raise ValueError("No Gemini API key")

    import httpx

    s = comparison['summary']
    gap_label = {'1m': '1 month', '3m': '3 months', '1yr': '1 year'}.get(comparison['gap'], comparison['gap'])

    loc_lines = "\n".join(
        f"  - {r['location']}: Old=${r['old']:,.0f}, New=${r['new']:,.0f}"
        + (f", Change={r['change_pct']:+.1f}%" if r.get('change_pct') is not None else "")
        for r in comparison['by_location'][:8]
    )
    cat_lines = "\n".join(
        f"  - {r['category']}: Old=${r['old']:,.0f}, New=${r['new']:,.0f}"
        + (f", Change={r['change_pct']:+.1f}%" if r.get('change_pct') is not None else "")
        for r in comparison['by_category'][:8]
    )

    rev_change_str = f"{s['revenue_change_pct']:+.1f}%" if s['revenue_change_pct'] is not None else 'N/A'

    prompt = f"""You are an expert business revenue analyst at RevenueRadar. Based on the data below,
write a comprehensive executive-level comparison report in Markdown.

TIME PERIOD: {gap_label}

REVENUE SUMMARY:
- Old period total revenue: ${s['total_revenue_old']:,.0f}
- New period total revenue: ${s['total_revenue_new']:,.0f}
- Change: {rev_change_str}
- Old avg revenue per record: ${s['avg_revenue_old']:,.0f}
- New avg revenue per record: ${s['avg_revenue_new']:,.0f}

BY LOCATION:
{loc_lines}

BY CATEGORY:
{cat_lines}

Write a well-structured Markdown report with:
1. An executive summary (2-3 sentences)
2. Key wins (top growing segments)
3. Areas of concern (declining segments)
4. 3 specific, actionable recommendations

Use emojis, bold numbers, and clear headers. Be concise but insightful."""

    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.4, "maxOutputTokens": 1024},
    }

    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-2.0-flash:generateContent?key={api_key}"
    )

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, json=payload)
        if resp.status_code != 200:
            raise ValueError(f"Gemini error: {resp.status_code}")
        data = resp.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("/compare")
async def compare_datasets(
    file_old: UploadFile = File(...),
    file_new: UploadFile = File(...),
    gap: str = Form(default="1m"),
):
    """
    Compare two datasets side-by-side.
    - file_old: the older / baseline dataset (CSV or XML)
    - file_new: the newer dataset (CSV or XML)
    - gap: time gap label — '1m', '3m', or '1yr'
    """
    allowed_gaps = ('1m', '3m', '1yr')
    if gap not in allowed_gaps:
        raise HTTPException(status_code=400, detail=f"gap must be one of {allowed_gaps}")

    try:
        content_old = await file_old.read()
        content_new = await file_new.read()

        if not content_old:
            raise HTTPException(status_code=400, detail="Old dataset file is empty")
        if not content_new:
            raise HTTPException(status_code=400, detail="New dataset file is empty")

        df_old = _parse_file(content_old, file_old.filename or 'old.csv')
        df_new = _parse_file(content_new, file_new.filename or 'new.csv')

        metrics_old = _compute_metrics(df_old)
        metrics_new = _compute_metrics(df_new)

        comparison = _build_comparison(metrics_old, metrics_new, gap)

        # Generate AI conclusion (async, with fallback)
        conclusion = await _generate_conclusion(comparison)

        return sanitize_for_json({
            **comparison,
            'conclusion': conclusion,
            'files': {
                'old': file_old.filename,
                'new': file_new.filename,
            }
        })

    except HTTPException as he:
        raise he
    except Exception as e:
        import traceback
        print(f"[Compare] Error: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Comparison failed: {str(e)}")
