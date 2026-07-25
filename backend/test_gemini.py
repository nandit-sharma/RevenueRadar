import asyncio
import os
import httpx
from dotenv import load_dotenv

load_dotenv()

async def test():
    key = os.getenv('GOOGLE_API_KEY')
    print("Gemini Key present:", bool(key), key[:15] if key else "")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={key}"
    payload = {
        "contents": [{"role": "user", "parts": [{"text": "Say hello professionally as a revenue analyst."}]}]
    }
    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.post(url, json=payload)
        print("Status code:", res.status_code)
        print("Response:", res.text[:300])

if __name__ == '__main__':
    asyncio.run(test())
