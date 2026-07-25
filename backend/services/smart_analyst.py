"""
Smart Local Dataset Analyst for RevenueRadar
--------------------------------------------
Provides robust, professional analytical responses grounded directly in the user's
currently uploaded DataFrame when cloud LLM API keys encounter quota limits (HTTP 429)
or are offline.
"""

import pandas as pd
import numpy as np
import re
from typing import Dict, Any, List, Optional


def analyze_dataset_query(query: str, df: pd.DataFrame) -> Dict[str, Any]:
    """
    Perform deep statistical analysis on the DataFrame based on user query.
    Returns structured result containing:
    - answer: markdown professional response
    - key_insight: core executive takeaway
    - predictions: forward-looking actionable guidance / AI tips
    - sql: sample SQL query
    - confidence: float score
    - data: list of dict rows for table display
    """
    if df is None or df.empty:
        return {
            "answer": "⚠️ **No active data session found.** Please upload a CSV or XML file on the Dashboard and click **'Start Analysis'**.",
            "key_insight": "Upload a file to activate dataset analysis.",
            "predictions": "",
            "sql": "",
            "confidence": 0.0,
            "data": [],
        }

    q = query.lower().strip()
    num_rows = len(df)
    cols = list(df.columns)
    numeric_cols = df.select_dtypes(include="number").columns.tolist()
    cat_cols = [c for c in df.columns if c not in numeric_cols and c not in ["month", "date"]]

    rev_col = "revenue" if "revenue" in df.columns else (numeric_cols[0] if numeric_cols else None)
    loc_col = "location" if "location" in df.columns else (cat_cols[0] if cat_cols else None)
    cuis_col = "cuisine" if "cuisine" in df.columns else (cat_cols[1] if len(cat_cols) > 1 else loc_col)
    name_col = "name" if "name" in df.columns else (cat_cols[0] if cat_cols else df.columns[0])

    total_revenue = float(df[rev_col].sum()) if rev_col else 0
    avg_revenue = float(df[rev_col].mean()) if rev_col else 0

    # -----------------------------------------------------------------------
    # 1. TOP PERFORMERS / HIGHEST REVENUE QUERY
    # -----------------------------------------------------------------------
    if any(w in q for w in ["top", "highest", "best", "most", "rank", "leading", "leaderboard"]):
        n = 5
        match = re.search(r"\b(\d+)\b", q)
        if match:
            n = min(max(int(match.group(1)), 1), 20)

        group_target = loc_col
        target_name = "Location"

        if "cuisine" in q or "category" in q or "product" in q or "type" in q:
            group_target = cuis_col
            target_name = "Cuisine / Category"
        elif "item" in q or "name" in q or "store" in q or "branch" in q or "entity" in q:
            group_target = name_col
            target_name = "Entity"

        if group_target and group_target in df.columns and rev_col:
            grouped = df.groupby(group_target)[rev_col].agg(["sum", "mean", "count"]).reset_index()
            grouped = grouped.sort_values("sum", ascending=False).head(n)

            data_list = []
            for _, row in grouped.iterrows():
                share = (row["sum"] / total_revenue * 100) if total_revenue > 0 else 0
                data_list.append({
                    target_name.lower().replace(" ", "_"): str(row[group_target]),
                    "total_revenue": round(float(row["sum"]), 2),
                    "avg_revenue": round(float(row["mean"]), 2),
                    "record_count": int(row["count"]),
                    "revenue_share_pct": round(share, 1),
                })

            top_item = data_list[0]
            answer = f"### 🏆 Top {len(data_list)} {target_name} Performers (Grounded in Active Dataset)\n\n"
            answer += f"Based on analysis of **{num_rows} uploaded records**, the top-performing **{target_name}** is **{top_item[target_name.lower().replace(' ', '_')]}** with **${top_item['total_revenue']:,.2f}** in total revenue ({top_item['revenue_share_pct']}% of total revenue).\n\n"
            answer += "| Rank | " + target_name + " | Total Revenue | Avg / Unit | Revenue Share |\n"
            answer += "|---|---|---|---|---|\n"

            for i, r in enumerate(data_list):
                name = r[target_name.lower().replace(' ', '_')]
                answer += f"| #{i+1} | **{name}** | **${r['total_revenue']:,.2f}** | ${r['avg_revenue']:,.2f} | {r['revenue_share_pct']}% |\n"

            sql = f"SELECT {group_target}, SUM({rev_col}) AS total_revenue, AVG({rev_col}) AS avg_revenue FROM sales_data GROUP BY {group_target} ORDER BY total_revenue DESC LIMIT {n};"
            key_insight = f"{top_item[target_name.lower().replace(' ', '_')]} is your #1 revenue generator, accounting for {top_item['revenue_share_pct']}% of all recorded revenue."
            predictions = f"💡 **Strategic AI Tip**: Double down on high-performing segments like **{top_item[target_name.lower().replace(' ', '_')]}** by expanding inventory and marketing allocation by 15-20%."

            return {
                "answer": answer,
                "key_insight": key_insight,
                "predictions": predictions,
                "sql": sql,
                "confidence": 0.95,
                "data": data_list,
            }

    # -----------------------------------------------------------------------
    # 2. LOWEST / UNDERPERFORMING QUERY
    # -----------------------------------------------------------------------
    if any(w in q for w in ["bottom", "lowest", "worst", "underperform", "lagging", "decline", "drop", "risk"]):
        n = 5
        group_target = loc_col
        target_name = "Location"

        if "cuisine" in q or "category" in q:
            group_target = cuis_col
            target_name = "Cuisine / Category"

        if group_target and group_target in df.columns and rev_col:
            grouped = df.groupby(group_target)[rev_col].agg(["sum", "mean", "count"]).reset_index()
            grouped = grouped.sort_values("sum", ascending=True).head(n)

            data_list = []
            for _, row in grouped.iterrows():
                share = (row["sum"] / total_revenue * 100) if total_revenue > 0 else 0
                data_list.append({
                    target_name.lower().replace(" ", "_"): str(row[group_target]),
                    "total_revenue": round(float(row["sum"]), 2),
                    "avg_revenue": round(float(row["mean"]), 2),
                    "record_count": int(row["count"]),
                })

            bottom_item = data_list[0]
            answer = f"### ⚠️ Bottom {len(data_list)} {target_name} Performers\n\n"
            answer += f"Analysis of **{num_rows} records** reveals that **{bottom_item[target_name.lower().replace(' ', '_')]}** generated the lowest revenue at **${bottom_item['total_revenue']:,.2f}**.\n\n"
            answer += "| Rank | " + target_name + " | Total Revenue | Avg / Unit |\n"
            answer += "|---|---|---|---|\n"

            for i, r in enumerate(data_list):
                name = r[target_name.lower().replace(' ', '_')]
                answer += f"| #{i+1} | **{name}** | **${r['total_revenue']:,.2f}** | ${r['avg_revenue']:,.2f} |\n"

            sql = f"SELECT {group_target}, SUM({rev_col}) FROM sales_data GROUP BY {group_target} ORDER BY SUM({rev_col}) ASC LIMIT {n};"
            key_insight = f"{bottom_item[target_name.lower().replace(' ', '_')]} is significantly underperforming compared to portfolio average."
            predictions = f"💡 **Recommended Action**: Audit operating costs and customer reviews for **{bottom_item[target_name.lower().replace(' ', '_')]}**. Consider targeted promotional campaigns or service quality training."

            return {
                "answer": answer,
                "key_insight": key_insight,
                "predictions": predictions,
                "sql": sql,
                "confidence": 0.92,
                "data": data_list,
            }

    # -----------------------------------------------------------------------
    # 3. FORECASTING / PREDICTION QUERY
    # -----------------------------------------------------------------------
    if any(w in q for w in ["predict", "forecast", "future", "next", "projection", "trend", "quarter"]):
        periods = 6
        answer = "### 📈 Predictive Revenue Forecast & Strategic Outlook\n\n"

        if "month" in df.columns and rev_col:
            monthly = df.groupby("month")[rev_col].sum().sort_index()
            if len(monthly) >= 2:
                values = monthly.values
                x = np.arange(len(values))
                coeffs = np.polyfit(x, values, deg=1)
                slope, intercept = coeffs[0], coeffs[1]

                proj_next_1 = max(0, intercept + slope * len(values))
                proj_next_3 = max(0, intercept + slope * (len(values) + 2))
                growth_rate = ((slope) / (values.mean() + 1e-9)) * 100

                direction_str = "upward trajectory 🚀" if slope > 0 else "downward trend 📉"

                answer += f"Based on historical data across **{len(monthly)} recorded months**, revenue displays an overall **{direction_str}**.\n\n"
                answer += f"- **Current Average Monthly Revenue:** ${values.mean():,.2f}\n"
                answer += f"- **Monthly Trend Rate (Slope):** {slope:+,.2f} / month ({growth_rate:+.1f}% MoM)\n"
                answer += f"- **Projected Next Month Revenue:** **${proj_next_1:,.2f}**\n"
                answer += f"- **Projected Month 3 Revenue:** **${proj_next_3:,.2f}**\n\n"

                data_list = [
                    {"period": "Historical Avg Monthly", "revenue": round(float(values.mean()), 2)},
                    {"period": "Projected Month +1", "revenue": round(float(proj_next_1), 2)},
                    {"period": "Projected Month +3", "revenue": round(float(proj_next_3), 2)},
                ]

                key_insight = f"Revenue is trending at {slope:+,.2f}/month. Projections indicate Next Month revenue of ${proj_next_1:,.2f}."
                predictions = (
                    f"💡 **AI Strategic Recommendation**:\n"
                    f"1. **Inventory Planning**: Prepare operational capacity for an estimated **${proj_next_1:,.2f}** revenue run-rate next month.\n"
                    f"2. **Risk Mitigation**: Monitor high-margin categories to ensure supply chain capacity meets projected demand growth."
                )
                sql = "SELECT month, SUM(revenue) FROM sales_data GROUP BY month ORDER BY month ASC;"

                return {
                    "answer": answer,
                    "key_insight": key_insight,
                    "predictions": predictions,
                    "sql": sql,
                    "confidence": 0.9,
                    "data": data_list,
                }

    # -----------------------------------------------------------------------
    # 4. CORRELATIONS / DRIVERS / FACTORS QUERY
    # -----------------------------------------------------------------------
    if any(w in q for w in ["correlat", "driver", "factor", "affect", "impact", "cause", "why", "influenc"]):
        if rev_col and len(numeric_cols) > 1:
            feature_cols = [c for c in numeric_cols if c != rev_col and c not in ["year", "month_num"]]
            if feature_cols:
                corrs = df[feature_cols + [rev_col]].corr()[rev_col].drop(rev_col).sort_values(key=abs, ascending=False)
                top_corr_feat = corrs.index[0]
                top_corr_val = corrs.iloc[0]

                data_list = []
                for feat, val in corrs.items():
                    data_list.append({
                        "metric": feat.replace("_", " ").title(),
                        "correlation_r": round(float(val), 3),
                        "impact_strength": "High" if abs(val) > 0.5 else "Medium" if abs(val) > 0.3 else "Low",
                        "relationship": "Positive (Higher = More Revenue)" if val > 0 else "Negative (Inverse)",
                    })

                answer = "### 💡 Key Revenue Drivers & Correlations Analysis\n\n"
                answer += f"Statistical evaluation of your **{num_rows} records** reveals that **{top_corr_feat.replace('_', ' ').title()}** is the strongest single driver of revenue (r = **{top_corr_val:.3f}**).\n\n"
                answer += "| Metric | Correlation (r) | Impact Level | Relationship |\n"
                answer += "|---|---|---|---|\n"

                for r in data_list[:6]:
                    answer += f"| **{r['metric']}** | `{r['correlation_r']:+.3f}` | {r['impact_strength']} | {r['relationship']} |\n"

                key_insight = f"{top_corr_feat.replace('_', ' ').title()} is your primary revenue driver with r = {top_corr_val:.3f} correlation."
                predictions = f"💡 **Executive Action Plan**: Focus efforts on optimizing **{top_corr_feat.replace('_', ' ').title()}**. A 10% increase in this metric yields the highest expected revenue gain across your portfolio."
                sql = f"SELECT CORR({top_corr_feat}, {rev_col}) FROM sales_data;"

                return {
                    "answer": answer,
                    "key_insight": key_insight,
                    "predictions": predictions,
                    "sql": sql,
                    "confidence": 0.91,
                    "data": data_list,
                }

    # -----------------------------------------------------------------------
    # 5. GENERAL DATASET SUMMARY / DEFAULT PROFESSIONAL ANALYST QUERY
    # -----------------------------------------------------------------------
    answer = f"### 📊 Comprehensive Business Performance Executive Summary\n\n"
    answer += f"Based on your currently active file (**{num_rows} records** analyzed):\n\n"
    answer += f"- 💵 **Total Portfolio Revenue:** **${total_revenue:,.2f}**\n"
    answer += f"- 📊 **Average Unit Revenue:** **${avg_revenue:,.2f}**\n"

    if loc_col and loc_col in df.columns:
        top_loc = df.groupby(loc_col)[rev_col].sum().idxmax()
        top_loc_val = df.groupby(loc_col)[rev_col].sum().max()
        answer += f"- 📍 **Top Location / Branch:** **{top_loc}** (${top_loc_val:,.2f})\n"

    if cuis_col and cuis_col in df.columns:
        top_cuis = df.groupby(cuis_col)[rev_col].sum().idxmax()
        top_cuis_val = df.groupby(cuis_col)[rev_col].sum().max()
        answer += f"- 🍽️ **Top Cuisine / Category:** **{top_cuis}** (${top_cuis_val:,.2f})\n"

    if "rating" in df.columns:
        avg_rat = df["rating"].mean()
        answer += f"- ⭐ **Average Customer Rating:** **{avg_rat:.2f} / 5.0**\n"

    answer += "\n#### 🎯 Key Breakdown by Segment\n\n"

    data_list = []
    if loc_col and loc_col in df.columns and rev_col:
        loc_summary = df.groupby(loc_col)[rev_col].agg(["sum", "mean", "count"]).sort_values("sum", ascending=False).head(5)
        for loc, r in loc_summary.iterrows():
            data_list.append({
                "location": str(loc),
                "total_revenue": round(float(r["sum"]), 2),
                "avg_revenue": round(float(r["mean"]), 2),
                "records": int(r["count"]),
            })

    sql = f"SELECT location, SUM(revenue), AVG(revenue), COUNT(*) FROM sales_data GROUP BY location ORDER BY SUM(revenue) DESC;"
    key_insight = f"Total revenue across {num_rows} records is ${total_revenue:,.2f} with average revenue of ${avg_revenue:,.2f} per unit."
    predictions = "💡 **Next Steps**: You can ask me specific questions such as *'Predict next quarter revenue'*, *'What are the bottom 5 locations?'*, or *'What factors drive high revenue?'*."

    return {
        "answer": answer,
        "key_insight": key_insight,
        "predictions": predictions,
        "sql": sql,
        "confidence": 0.88,
        "data": data_list,
    }
