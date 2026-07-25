import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

async def test():
    key = os.getenv('OPENAI_API_KEY')
    print("API Key present:", bool(key), key[:15] if key else "")
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=key)
        res = await client.chat.completions.create(
            model='gpt-4o-mini',
            messages=[{'role':'user','content':'hello'}],
            max_tokens=50
        )
        print("Success:", res.choices[0].message.content)
    except Exception as e:
        print("Error:", type(e), e)

if __name__ == '__main__':
    asyncio.run(test())
