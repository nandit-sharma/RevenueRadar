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

def dataframe_to_context(df: pd.DataFrame, query: str = "") -> str:
    """Create a concise summary of the dataset for AI context, potentially filtered by query."""
    # Basic summary
    numeric_summary = df.describe().round(2).to_string()
    columns = list(df.columns)
    locations = df['location'].unique().tolist() if 'location' in df.columns else []
    cuisines = df['cuisine'].unique().tolist() if 'cuisine' in df.columns else []

    # If the query mentions a specific location or cuisine, include specific data for it
    query_lower = query.lower()
    specific_context = ""
    
    if any(loc.lower() in query_lower for loc in locations):
        for loc in locations:
            if loc.lower() in query_lower:
                loc_df = df[df['location'] == loc]
                specific_context += f"\nData for {loc}:\n{loc_df.describe().round(2).to_string()}\n"
    
    if any(c.lower() in query_lower for c in cuisines):
        for c in cuisines:
            if c.lower() in query_lower:
                c_df = df[df['cuisine'] == c]
                specific_context += f"\nData for {c} cuisine:\n{c_df.describe().round(2).to_string()}\n"

    # Add a sample of top 5 records by revenue
    top_records = df.sort_values(by='revenue', ascending=False).head(5).to_string()

    return f"""
Dataset Summary:
- Total records: {len(df)}
- Columns: {', '.join(columns)}
- Available locations: {', '.join(map(str, locations[:10]))}
- Available cuisines: {', '.join(map(str, cuisines[:10]))}
- Revenue range: ${df['revenue'].min():,.0f} to ${df['revenue'].max():,.0f}
- Total revenue: ${df['revenue'].sum():,.0f}
- Average revenue: ${df['revenue'].mean():,.0f}

Top 5 Restaurants by Revenue:
{top_records}

Numeric statistics (Overall):
{numeric_summary}
{specific_context}
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
            result_data = [{"location": str(k), "revenue": float(v)} for k, v in result.items()]
            answer = f"The top {n} locations by revenue are: " + ", ".join([f"{r['location']} (${r['revenue']:,.0f})" for r in result_data[:3]])
            sql_hint = f"SELECT location, SUM(revenue) as revenue FROM sales_data GROUP BY location ORDER BY revenue DESC LIMIT {n}"
        elif 'cuisine' in q:
            result = df.groupby('cuisine')['revenue'].sum().sort_values(ascending=False).head(n)
            result_data = [{"cuisine": str(k), "revenue": float(v)} for k, v in result.items()]
            answer = f"The top {n} cuisines by revenue: " + ", ".join([f"{r['cuisine']} (${r['revenue']:,.0f})" for r in result_data[:3]])
            sql_hint = f"SELECT cuisine, SUM(revenue) as revenue FROM sales_data GROUP BY cuisine ORDER BY revenue DESC LIMIT {n}"
        else:
            name_col = 'name' if 'name' in df.columns else df.columns[0]
            result = df.groupby(name_col)['revenue'].sum().sort_values(ascending=False).head(n)
            result_data = [{name_col: str(k), "revenue": float(v)} for k, v in result.items()]
            answer = f"Top {n} restaurants by revenue: " + ", ".join([f"{r[name_col]} (${r['revenue']:,.0f})" for r in result_data[:3]])
            sql_hint = f"SELECT {name_col}, SUM(revenue) as revenue FROM sales_data GROUP BY {name_col} ORDER BY revenue DESC LIMIT {n}"

    elif 'average' in q or 'avg' in q:
        if 'rating' in q and 'rating' in df.columns:
            val = float(df['rating'].mean())
            answer = f"The average rating across all restaurants is {val:.2f} out of 5."
            result_data = [{"metric": "Average Rating", "value": val}]
            sql_hint = "SELECT AVG(rating) as avg_rating FROM sales_data"
        elif 'revenue' in q:
            val = float(df['revenue'].mean())
            answer = f"The average revenue is ${val:,.2f}."
            result_data = [{"metric": "Average Revenue", "value": val}]
            sql_hint = "SELECT AVG(revenue) as avg_revenue FROM sales_data"
        elif 'price' in q and 'avg_meal_price' in df.columns:
            val = float(df['avg_meal_price'].mean())
            answer = f"The average meal price is ${val:.2f}."
            result_data = [{"metric": "Average Meal Price", "value": val}]
            sql_hint = "SELECT AVG(avg_meal_price) as avg_price FROM sales_data"

    elif 'marketing' in q and 'revenue' in q:
        if 'marketing_budget' in df.columns:
            corr = float(df['marketing_budget'].corr(df['revenue']))
            answer = f"Marketing budget has a {'strong' if abs(corr) > 0.5 else 'moderate' if abs(corr) > 0.3 else 'weak'} {'positive' if corr > 0 else 'negative'} correlation with revenue (r={corr:.3f}). {'Marketing does significantly drive revenue.' if corr > 0.5 else 'Other factors may matter more.'}"
            result_data = [{"feature": "marketing_budget", "correlation": corr}]
            sql_hint = "SELECT CORR(marketing_budget, revenue) FROM sales_data"

    elif 'drop' in q or 'decline' in q or 'why' in q:
        if 'month' in df.columns:
            monthly = df.groupby('month')['revenue'].sum().sort_index()
            if len(monthly) >= 2:
                worst_month = str(monthly.idxmin())
                worst_val = float(monthly.min())
                best_month = str(monthly.idxmax())
                best_val = float(monthly.max())
                answer = f"Revenue was lowest in {worst_month} (${worst_val:,.0f}) and highest in {best_month} (${best_val:,.0f}). Possible causes for drops include seasonal effects, lower marketing spend, or reduced reservations in those periods."
                result_data = [{"month": str(k), "revenue": float(v)} for k, v in monthly.items()]

    elif 'total revenue' in q or 'overall revenue' in q:
        val = float(df['revenue'].sum())
        answer = f"Total revenue across all restaurants is ${val:,.2f}."
        result_data = [{"metric": "Total Revenue", "value": val}]
        sql_hint = "SELECT SUM(revenue) as total_revenue FROM sales_data"

    elif 'revenue' in q and any(name.lower() in q for name in df['name'].unique().tolist()):
        names = df['name'].unique().tolist()
        for name in names:
            if name.lower() in q:
                entity_df = df[df['name'] == name]
                total_rev = float(entity_df['revenue'].sum())
                count = len(entity_df)
                answer = f"{name} generated a total revenue of ${total_rev:,.2f} across {count} records."
                result_data = [{"entity": name, "revenue": total_rev, "records": count}]
                sql_hint = f"SELECT SUM(revenue) FROM sales_data WHERE name = '{name}'"
                break

    elif 'forecast' in q or 'predict' in q or 'next' in q:
        answer = "Based on historical trends, revenue is projected to grow. Please check the Forecasting page for detailed projections with confidence intervals."
        result_data = []

    if not answer:
        # Generic summary
        total_rev = float(df['revenue'].sum())
        avg_rating = float(df['rating'].mean()) if 'rating' in df.columns else 0
        top_loc = str(df.groupby('location')['revenue'].sum().idxmax()) if 'location' in df.columns else "N/A"
        
        answer = f"Based on the dataset with {len(df)} records: Total revenue is ${total_rev:,.0f}, average rating is {avg_rating:.2f}, and the top performing location is {top_loc}. Try asking about specific cuisines, locations, or revenue drivers for more details."
        result_data = [
            {"metric": "Total Revenue", "value": total_rev},
            {"metric": "Total Records", "value": int(len(df))},
            {"metric": "Avg Rating", "value": avg_rating},
        ]

    return {
        "answer": answer,
        "data": result_data,
        "sql": sql_hint,
        "confidence": 0.85
    }

async def call_ai_api(question: str, context: str, history: list) -> str:
    """Call AI API (Claude or OpenAI) for intelligent responses."""
    # Try Claude first
    api_key_anthropic = os.getenv("ANTHROPIC_API_KEY", "")
    if api_key_anthropic:
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=api_key_anthropic)
            
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
                model="claude-3-5-sonnet-20240620",
                max_tokens=800,
                system=system_prompt,
                messages=messages
            )
            return response.content[0].text
        except Exception as e:
            print(f"Claude API Error: {str(e)}")

    # Try OpenAI second
    api_key_openai = os.getenv("OPENAI_API_KEY", "")
    if api_key_openai:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=api_key_openai)
            
            messages = [
                {"role": "system", "content": f"You are RevenueRadar's AI business analyst. You help users understand their restaurant revenue data. Use this context:\n{context}\n\nRespond with a JSON object containing 'answer', 'sql', 'confidence', and 'key_insight'. Always respond with valid JSON only."},
            ]
            for h in history[-6:]:
                messages.append({"role": h["role"], "content": h["content"]})
            messages.append({"role": "user", "content": question})

            response = client.chat.completions.create(
                model="gpt-4-turbo-preview",
                messages=messages,
                response_format={"type": "json_object"}
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"OpenAI API Error: {str(e)}")

    return None


@router.post("/chat-query")
async def chat_query(request: ChatRequest):
    df = get_dataframe()
    context = dataframe_to_context(df, request.message)

    # Try AI APIs
    ai_response = await call_ai_api(request.message, context, request.history)

    if ai_response:
        try:
            # Clean JSON response
            clean = ai_response.strip()
            if clean.startswith("```"):
                clean = re.sub(r'```\w*\n?', '', clean).strip()

            parsed = json.loads(clean)

            # Execute rule-based for data visualization if needed
            rule_result = execute_nl_query(request.message, df)

            return {
                "answer": parsed.get("answer", rule_result["answer"]),
                "sql": parsed.get("sql", rule_result.get("sql", "")),
                "confidence": parsed.get("confidence", 0.9),
                "key_insight": parsed.get("key_insight", ""),
                "data": rule_result["data"],
                "source": "ai"
            }
        except Exception as e:
            print(f"Error parsing AI response: {str(e)}")
            pass

    # Fallback to rule-based
    result = execute_nl_query(request.message, df)
    return {
        **result,
        "key_insight": "Analysis based on current dataset. (Rule-based fallback)",
        "source": "rules"
    }
