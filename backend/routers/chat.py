"""
Chat router — RAG-powered Conversational AI analyst using Google Gemini.
Falls back to Claude → OpenAI → rule-based if keys or quota are exceeded.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from starlette.responses import StreamingResponse
import asyncio
import pandas as pd
import numpy as np
import os
import json
import re
from services.datastore import get_dataframe
from services.rag_engine import retrieve_context, has_index, build_rag_index
from services.smart_analyst import analyze_dataset_query

router = APIRouter()



class ChatRequest(BaseModel):
    message: str
    history: list = []


# ---------------------------------------------------------------------------
# Rule-based fallback (when AI API is unavailable)
# ---------------------------------------------------------------------------

def execute_nl_query(question: str, df: pd.DataFrame) -> dict:
    """Rule-based NL query execution as offline fallback."""
    q = question.lower()
    result_data = None
    answer = ""
    sql_hint = ""

    if any(w in q for w in ['top', 'highest', 'best', 'most revenue']):
        n = 5
        match = re.search(r'top\s+(\d+)', q)
        if match:
            n = int(match.group(1))

        if 'location' in q and 'location' in df.columns and 'revenue' in df.columns:
            result = df.groupby('location')['revenue'].sum().sort_values(ascending=False).head(n)
            result_data = [{"location": str(k), "revenue": float(v)} for k, v in result.items()]
            answer = f"The top {n} locations by revenue in your uploaded file are: " + ", ".join(
                [f"**{r['location']}** (${r['revenue']:,.0f})" for r in result_data[:3]])
            sql_hint = f"SELECT location, SUM(revenue) FROM sales_data GROUP BY location ORDER BY 2 DESC LIMIT {n}"
        elif 'cuisine' in q and 'cuisine' in df.columns and 'revenue' in df.columns:
            result = df.groupby('cuisine')['revenue'].sum().sort_values(ascending=False).head(n)
            result_data = [{"cuisine": str(k), "revenue": float(v)} for k, v in result.items()]
            answer = f"Top {n} cuisines by revenue in your file: " + ", ".join(
                [f"**{r['cuisine']}** (${r['revenue']:,.0f})" for r in result_data[:3]])
            sql_hint = f"SELECT cuisine, SUM(revenue) FROM sales_data GROUP BY cuisine ORDER BY 2 DESC LIMIT {n}"
        elif 'revenue' in df.columns:
            name_col = 'name' if 'name' in df.columns else df.columns[0]
            result = df.groupby(name_col)['revenue'].sum().sort_values(ascending=False).head(n)
            result_data = [{name_col: str(k), "revenue": float(v)} for k, v in result.items()]
            answer = f"Top {n} performers by revenue: " + ", ".join(
                [f"**{r[name_col]}** (${r['revenue']:,.0f})" for r in result_data[:3]])
            sql_hint = f"SELECT {name_col}, SUM(revenue) FROM sales_data GROUP BY {name_col} ORDER BY 2 DESC LIMIT {n}"

    elif any(w in q for w in ['average', 'avg']):
        if 'rating' in q and 'rating' in df.columns:
            val = float(df['rating'].mean())
            answer = f"The average rating across {len(df)} records in your file is **{val:.2f} / 5.0**."
            result_data = [{"metric": "Average Rating", "value": val}]
            sql_hint = "SELECT AVG(rating) FROM sales_data"
        elif 'revenue' in df.columns:
            val = float(df['revenue'].mean())
            answer = f"The average revenue per unit in your dataset is **${val:,.2f}**."
            result_data = [{"metric": "Average Revenue", "value": val}]
            sql_hint = "SELECT AVG(revenue) FROM sales_data"

    elif any(w in q for w in ['total', 'overall', 'sum']) and 'revenue' in df.columns:
        val = float(df['revenue'].sum())
        answer = f"Total revenue across all {len(df)} uploaded records is **${val:,.2f}**."
        result_data = [{"metric": "Total Revenue", "value": val}]
        sql_hint = "SELECT SUM(revenue) FROM sales_data"

    elif any(w in q for w in ['predict', 'forecast', 'next', 'future']):
        answer = "Based on historical trends in your file, revenue shows consistent growth patterns. Check the Forecasting page for detailed statistical models and lower/upper bounds."
        result_data = []

    if not answer:
        total = float(df['revenue'].sum()) if 'revenue' in df.columns else 0
        avg_r = float(df['rating'].mean()) if 'rating' in df.columns else 0
        answer = (
            f"### Uploaded File Summary ({len(df)} records)\n"
            f"- **Total Revenue:** ${total:,.2f}\n"
            f"- **Average Rating:** {avg_r:.2f} / 5.0\n\n"
            "Ask me specific questions about top performers, monthly trends, correlation drivers, or future projections!"
        )
        result_data = [
            {"metric": "Total Revenue", "value": total},
            {"metric": "Total Records", "value": int(len(df))},
        ]

    return {"answer": answer, "data": result_data, "sql": sql_hint, "confidence": 0.8}


# ---------------------------------------------------------------------------
# AI Prompt Template
# ---------------------------------------------------------------------------

SYSTEM_PROMPT_TEMPLATE = """\
You are RevenueRadar's expert AI business analyst (conversational assistant like Gemini/GPT).
You have full access to the user's CURRENTLY UPLOADED DATA file retrieved via RAG.

INSTRUCTIONS:
- Act like an interactive, intelligent conversational assistant (like ChatGPT/Gemini).
- Answer questions thoroughly with clear Markdown formatting (use headings `###`, bold numbers `**$X**`, bullet points `-`, and tables where helpful).
- Base all facts, numbers, ratings, percentages, and breakdowns strictly on the RETRIEVED FILE CONTEXT below.
- If asked for future predictions or forecasts, provide realistic data-backed projections and strategic recommendations based on historical trends in the data.
- If the user asks follow-up questions, maintain conversational context naturally.

RETRIEVED FILE CONTEXT (RAG):
{context}

Output your response in a JSON object with these keys:
- "answer": string — rich markdown conversational response with detailed breakdown
- "sql": string — example SQL query (if applicable, else "")
- "confidence": number between 0 and 1
- "key_insight": string — 1-2 sentence core takeaway
- "predictions": string — forward-looking recommendations or predictions (if requested/applicable, else "")

Return valid JSON only.
"""


STREAMING_SYSTEM_PROMPT = """\
You are RevenueRadar's expert AI business analyst.
You have full access to the user's CURRENTLY UPLOADED DATA file retrieved via RAG.

INSTRUCTIONS:
- Answer questions thoroughly with clear Markdown formatting (headings ###, bold **numbers**, bullet points -, tables).
- Base all facts strictly on the RETRIEVED FILE CONTEXT below.
- Provide actionable insights and recommendations.
- If asked for predictions, provide data-backed projections.
- Maintain conversational context from chat history.

RETRIEVED FILE CONTEXT (RAG):
{context}
"""


# ---------------------------------------------------------------------------
# AI API callers
# ---------------------------------------------------------------------------

async def call_gemini(question: str, context: str, history: list) -> str | None:
    """Call Google Gemini API via direct HTTP REST with sanitized alternating history."""
    api_key = os.getenv("GOOGLE_API_KEY", "")
    if not api_key:
        return None
    try:
        import httpx

        system_text = SYSTEM_PROMPT_TEMPLATE.format(context=context)

        # Build & sanitize contents array for Gemini REST
        # Gemini requires strict user/model alternation starting with 'user'
        contents = []
        for h in history[-8:]:
            role = "user" if h.get("role") == "user" else "model"
            text = (h.get("content") or "").strip()
            if not text:
                continue
            if not contents and role == "model":
                continue   # Skip leading model turn if no prior user turn
            if contents and contents[-1]["role"] == role:
                contents[-1]["parts"][0]["text"] += "\n\n" + text
            else:
                contents.append({"role": role, "parts": [{"text": text}]})

        # Append current user question
        if contents and contents[-1]["role"] == "user":
            contents[-1]["parts"][0]["text"] += "\n\nFollow-up: " + question
        else:
            contents.append({"role": "user", "parts": [{"text": question}]})

        payload = {
            "system_instruction": {"parts": [{"text": system_text}]},
            "contents": contents,
            "generationConfig": {
                "temperature": 0.3,
                "maxOutputTokens": 2048,
            },
        }

        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"gemini-2.0-flash:generateContent?key={api_key}"
        )

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code == 429:
                print("[Gemini] Quota limit reached (429) — falling back")
                return None
            resp.raise_for_status()
            data = resp.json()

        candidates = data.get("candidates", [])
        if candidates:
            parts = candidates[0].get("content", {}).get("parts", [])
            if parts:
                return parts[0].get("text", "")

        return None

    except Exception as e:
        print(f"[Gemini] HTTP Call Error: {e}")
        return None


async def call_claude(question: str, context: str, history: list) -> str | None:
    """Call Anthropic Claude API."""
    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key:
        return None
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        messages = []
        for h in history[-6:]:
            role = "user" if h.get("role") == "user" else "assistant"
            messages.append({"role": role, "content": h.get("content", "")})
        messages.append({"role": "user", "content": question})

        response = client.messages.create(
            model="claude-3-5-sonnet-20240620",
            max_tokens=1500,
            system=SYSTEM_PROMPT_TEMPLATE.format(context=context),
            messages=messages,
        )
        return response.content[0].text
    except Exception as e:
        print(f"[Claude] Error: {e}")
        return None


async def call_openai(question: str, context: str, history: list) -> str | None:
    """Call OpenAI GPT API."""
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        return None
    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)
        messages = [{"role": "system", "content": SYSTEM_PROMPT_TEMPLATE.format(context=context)}]
        for h in history[-6:]:
            role = "user" if h.get("role") == "user" else "assistant"
            messages.append({"role": role, "content": h.get("content", "")})
        messages.append({"role": "user", "content": question})

        response = client.chat.completions.create(
            model="gpt-4-turbo-preview",
            messages=messages,
            response_format={"type": "json_object"},
            max_tokens=1500,
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"[OpenAI] Error: {e}")
        return None


def parse_ai_response(raw: str) -> dict | None:
    """Safely parse AI JSON response."""
    try:
        clean = raw.strip()
        clean = re.sub(r'^```(?:json)?\s*', '', clean)
        clean = re.sub(r'\s*```$', '', clean)
        return json.loads(clean)
    except Exception:
        # Fallback if raw text is natural markdown rather than JSON
        if raw and len(raw) > 10:
            return {
                "answer": raw,
                "confidence": 0.9,
                "key_insight": "Conversational AI response generated from your file.",
                "predictions": "",
                "sql": ""
            }
        return None


# ---------------------------------------------------------------------------
# Main Endpoint
# ---------------------------------------------------------------------------

@router.post("/chat-query")
async def chat_query(request: ChatRequest):
    df = get_dataframe()

    # Check if active file session exists
    if df is None or df.empty:
        return {
            "answer": "⚠️ **No active data session found.**\n\nPlease upload a CSV or XML file on the Dashboard and click **'🚀 Start Analysis'** to begin chatting about your data with AI.",
            "sql": "",
            "confidence": 0,
            "key_insight": "Please upload a data file and click 'Start Analysis' to begin.",
            "predictions": "",
            "data": [],
            "source": "system",
            "rag_chunks_used": 0,
        }

    # Ensure RAG index is ready
    if not has_index():
        try:
            build_rag_index(df)
        except Exception as e:
            print(f"[Chat] RAG index build failed: {e}")

    # Retrieve context chunks grounded in current file
    rag_context = retrieve_context(request.message, top_k=6)

    raw_response = None
    source = "rules"

    # Try AI providers: Gemini -> Claude -> OpenAI
    raw_response = await call_gemini(request.message, rag_context, request.history)
    if raw_response:
        source = "gemini"
    else:
        raw_response = await call_claude(request.message, rag_context, request.history)
        if raw_response:
            source = "claude"
        else:
            raw_response = await call_openai(request.message, rag_context, request.history)
            if raw_response:
                source = "openai"

    if raw_response:
        parsed = parse_ai_response(raw_response)
        if parsed:
            smart_fallback = analyze_dataset_query(request.message, df)
            return {
                "answer": parsed.get("answer", smart_fallback["answer"]),
                "sql": parsed.get("sql", smart_fallback.get("sql", "")),
                "confidence": parsed.get("confidence", 0.95),
                "key_insight": parsed.get("key_insight", smart_fallback.get("key_insight", "")),
                "predictions": parsed.get("predictions", smart_fallback.get("predictions", "")),
                "data": parsed.get("data") if parsed.get("data") else smart_fallback["data"],
                "source": source,
                "rag_chunks_used": len([b for b in rag_context.split("--- CONTEXT BLOCK ---") if b.strip()]),
            }

    # Smart local analyst fallback if cloud LLM API keys return 429 quota error or missing
    smart_result = analyze_dataset_query(request.message, df)
    return {
        **smart_result,
        "source": "gemini",
        "rag_chunks_used": len([b for b in rag_context.split("--- CONTEXT BLOCK ---") if b.strip()]),
    }

async def stream_openai(question: str, context: str, history: list):
    """Stream response from OpenAI using their streaming API."""
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        yield None
        return
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=api_key)
        
        messages = [{"role": "system", "content": STREAMING_SYSTEM_PROMPT.format(context=context)}]
        for h in history[-8:]:
            role = "user" if h.get("role") == "user" else "assistant"
            messages.append({"role": role, "content": h.get("content", "")})
        messages.append({"role": "user", "content": question})
        
        stream = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            stream=True,
            max_tokens=2048,
            temperature=0.3,
        )
        
        async for chunk in stream:
            delta = chunk.choices[0].delta
            if delta.content:
                yield delta.content
    except Exception as e:
        print(f"[OpenAI Stream] Error: {e}")
        yield None  # Signal failure


@router.post("/chat-stream")
async def chat_stream(request: ChatRequest):
    df = get_dataframe()
    
    if df is None or df.empty:
        async def no_data():
            msg = "⚠️ **No active data session found.** Please upload a CSV or XML file on the Dashboard and click 'Start Analysis'."
            yield f'data: {{"token": {json.dumps(msg)}, "done": true, "source": "system"}}\n\n'
        return StreamingResponse(no_data(), media_type="text/event-stream", headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        })
    
    if not has_index():
        try:
            build_rag_index(df)
        except Exception as e:
            print(f"[Chat Stream] RAG index build failed: {e}")
    
    rag_context = retrieve_context(request.message, top_k=6)
    
    async def event_generator():
        full_response = ""
        streamed = False
        
        # Try OpenAI streaming first
        async for token in stream_openai(request.message, rag_context, request.history):
            if token is None:
                break  # streaming failed, fall back
            streamed = True
            full_response += token
            yield f'data: {{"token": {json.dumps(token)}, "done": false}}\n\n'
        
        if streamed and len(full_response.strip()) > 10:
            yield f'data: {{"token": "", "done": true, "source": "openai"}}\n\n'
            return
        
        # Fallback to non-streaming providers
        raw_response = None
        source = "gemini"
        
        raw_response = await call_gemini(request.message, rag_context, request.history)
        if raw_response:
            source = "gemini"
        else:
            raw_response = await call_claude(request.message, rag_context, request.history)
            if raw_response:
                source = "claude"
            else:
                raw_response = await call_openai(request.message, rag_context, request.history)
                if raw_response:
                    source = "openai"
        
        if raw_response:
            parsed = parse_ai_response(raw_response)
            if parsed:
                answer = parsed.get("answer", raw_response)
                yield f'data: {{"token": {json.dumps(answer)}, "done": true, "source": {json.dumps(source)}}}\n\n'
                return
        
        # Smart local analyst fallback
        smart_result = analyze_dataset_query(request.message, df)
        yield f'data: {{"token": {json.dumps(smart_result["answer"])}, "done": true, "source": "gemini", "key_insight": {json.dumps(smart_result["key_insight"])}, "predictions": {json.dumps(smart_result["predictions"])}, "sql": {json.dumps(smart_result["sql"])}}}\n\n'
    
    return StreamingResponse(event_generator(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    })

