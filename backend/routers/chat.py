from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import pandas as pd
import numpy as np
import os
import json
import re
from services.datastore import get_dataframe

router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    history: list = []

def dataframe_to_context(df: pd.DataFrame) -> str:
    """Create a concise summary of the dataset for AI context."""
    numeric_summary = df.describe().round(2).to_string()
    columns = list(df.columns)
    locations = df['location'].unique().tolist() if 'location' in df.columns else []
    cuisines = df['cuisine'].unique().tolist() if 'cuisine' in df.columns else []

    return f"""
Dataset Summary:
- Total records: {len(df)}
- Columns: {', '.join(columns)}
- Available locations: {', '.join(map(str, locations[:10]))}
- Available cuisines: {', '.join(map(str, cuisines[:10]))}
- Revenue range: ${df['revenue'].min():,.0f} to ${df['revenue'].max():,.0f}
- Total revenue: ${df['revenue'].sum():,.0f}
- Average revenue: ${df['revenue'].mean():,.0f}

Numeric statistics:
{numeric_summary}
"""

def execute_nl_query(question: str, df: pd.DataFrame) -> dict:
    """Rule-based NL query execution as fallback."""
    q = question.lower()

    result_data = None
    answer = ""
    sql_hint = ""

    if any(w in q for w in ['top', 'highest', 'best', 'most revenue']):
        n = 5
        match = re.search(r'top\s+(\d+)', q)
        if match:
            n = int(match.group(1))

        if 'location' in q:
            result = df.groupby('location')['revenue'].sum().sort_values(ascending=False).head(n)
            result_data = [{"location": k, "revenue": round(v, 2)} for k, v in result.items()]
            answer = f"The top {n} locations by revenue are: " + ", ".join([f"{r['location']} (${r['revenue']:,.0f})" for r in result_data[:3]])
            sql_hint = f"SELECT location, SUM(revenue) as revenue FROM sales_data GROUP BY location ORDER BY revenue DESC LIMIT {n}"
        elif 'cuisine' in q:
            result = df.groupby('cuisine')['revenue'].sum().sort_values(ascending=False).head(n)
            result_data = [{"cuisine": k, "revenue": round(v, 2)} for k, v in result.items()]
            answer = f"The top {n} cuisines by revenue: " + ", ".join([f"{r['cuisine']} (${r['revenue']:,.0f})" for r in result_data[:3]])
            sql_hint = f"SELECT cuisine, SUM(revenue) as revenue FROM sales_data GROUP BY cuisine ORDER BY revenue DESC LIMIT {n}"
        else:
            name_col = 'name' if 'name' in df.columns else df.columns[0]
            result = df.groupby(name_col)['revenue'].sum().sort_values(ascending=False).head(n)
            result_data = [{name_col: k, "revenue": round(v, 2)} for k, v in result.items()]
            answer = f"Top {n} restaurants by revenue: " + ", ".join([f"{r[name_col]} (${r['revenue']:,.0f})" for r in result_data[:3]])
            sql_hint = f"SELECT name, SUM(revenue) as revenue FROM sales_data GROUP BY name ORDER BY revenue DESC LIMIT {n}"

    elif 'average' in q or 'avg' in q:
        if 'rating' in q and 'rating' in df.columns:
            val = df['rating'].mean()
            answer = f"The average rating across all restaurants is {val:.2f} out of 5."
            result_data = [{"metric": "Average Rating", "value": round(val, 2)}]
            sql_hint = "SELECT AVG(rating) as avg_rating FROM sales_data"
        elif 'revenue' in q:
            val = df['revenue'].mean()
            answer = f"The average revenue is ${val:,.2f}."
            result_data = [{"metric": "Average Revenue", "value": round(val, 2)}]
            sql_hint = "SELECT AVG(revenue) as avg_revenue FROM sales_data"
        elif 'price' in q and 'avg_meal_price' in df.columns:
            val = df['avg_meal_price'].mean()
            answer = f"The average meal price is ${val:.2f}."
            result_data = [{"metric": "Average Meal Price", "value": round(val, 2)}]
            sql_hint = "SELECT AVG(avg_meal_price) as avg_price FROM sales_data"

    elif 'marketing' in q and 'revenue' in q:
        if 'marketing_budget' in df.columns:
            corr = df['marketing_budget'].corr(df['revenue'])
            answer = f"Marketing budget has a {'strong' if abs(corr) > 0.5 else 'moderate' if abs(corr) > 0.3 else 'weak'} {'positive' if corr > 0 else 'negative'} correlation with revenue (r={corr:.3f}). {'Marketing does significantly drive revenue.' if corr > 0.5 else 'Other factors may matter more.'}"
            result_data = [{"feature": "marketing_budget", "correlation": round(corr, 3)}]
            sql_hint = "SELECT CORR(marketing_budget, revenue) FROM sales_data"

    elif 'drop' in q or 'decline' in q or 'why' in q:
        if 'month' in df.columns:
            monthly = df.groupby('month')['revenue'].sum().sort_index()
            if len(monthly) >= 2:
                worst_month = monthly.idxmin()
                worst_val = monthly.min()
                best_month = monthly.idxmax()
                best_val = monthly.max()
                answer = f"Revenue was lowest in {worst_month} (${worst_val:,.0f}) and highest in {best_month} (${best_val:,.0f}). Possible causes for drops include seasonal effects, lower marketing spend, or reduced reservations in those periods."
                result_data = [{"month": k, "revenue": round(v, 2)} for k, v in monthly.items()]

    elif 'total revenue' in q or 'overall revenue' in q:
        val = df['revenue'].sum()
        answer = f"Total revenue across all restaurants is ${val:,.2f}."
        result_data = [{"metric": "Total Revenue", "value": round(val, 2)}]
        sql_hint = "SELECT SUM(revenue) as total_revenue FROM sales_data"

    elif 'forecast' in q or 'predict' in q or 'next' in q:
        answer = "Based on historical trends, revenue is projected to grow. Please check the Forecasting page for detailed projections with confidence intervals."
        result_data = []

    if not answer:
        # Generic summary
        answer = f"Based on the dataset with {len(df)} records: Total revenue is ${df['revenue'].sum():,.0f}, average rating is {df['rating'].mean():.2f}, and the top performing location is {df.groupby('location')['revenue'].sum().idxmax()}. Try asking about specific cuisines, locations, or revenue drivers for more details."
        result_data = [
            {"metric": "Total Revenue", "value": round(df['revenue'].sum(), 2)},
            {"metric": "Total Records", "value": len(df)},
            {"metric": "Avg Rating", "value": round(df['rating'].mean(), 2) if 'rating' in df.columns else "N/A"},
        ]

    return {
        "answer": answer,
        "data": result_data,
        "sql": sql_hint,
        "confidence": 0.85
    }

async def call_claude_api(question: str, context: str, history: list) -> str:
    """Call Claude API for intelligent responses."""
    try:
        import anthropic
        api_key = os.getenv("ANTHROPIC_API_KEY", "")
        if not api_key:
            return None

        client = anthropic.Anthropic(api_key=api_key)

        system_prompt = f"""You are RevenueRadar's AI business analyst. You help users understand their restaurant revenue data.

{context}

Respond with a JSON object containing:
- "answer": string (natural language explanation, 2-3 sentences)
- "sql": string (example SQL query that would answer the question, or empty string)
- "confidence": number (0-1)
- "key_insight": string (one key takeaway)

Be specific with numbers from the data. Always respond with valid JSON only."""

        messages = []
        for h in history[-6:]:
            messages.append({"role": h["role"], "content": h["content"]})
        messages.append({"role": "user", "content": question})

        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=500,
            system=system_prompt,
            messages=messages
        )

        return response.content[0].text
    except Exception as e:
        return None


@router.post("/chat-query")
async def chat_query(request: ChatRequest):
    df = get_dataframe()
    context = dataframe_to_context(df)

    # Try Claude API first
    claude_response = await call_claude_api(request.message, context, request.history)

    if claude_response:
        try:
            # Clean JSON response
            clean = claude_response.strip()
            if clean.startswith("```"):
                clean = re.sub(r'```\w*\n?', '', clean).strip()

            parsed = json.loads(clean)

            # Execute rule-based for data
            rule_result = execute_nl_query(request.message, df)

            return {
                "answer": parsed.get("answer", rule_result["answer"]),
                "sql": parsed.get("sql", rule_result.get("sql", "")),
                "confidence": parsed.get("confidence", 0.9),
                "key_insight": parsed.get("key_insight", ""),
                "data": rule_result["data"],
                "source": "ai"
            }
        except Exception:
            pass

    # Fallback to rule-based
    result = execute_nl_query(request.message, df)
    return {
        **result,
        "key_insight": "Analysis based on current dataset.",
        "source": "rules"
    }
