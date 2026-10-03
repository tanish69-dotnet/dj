import os
import httpx


GEMINI_BASE_URL = os.getenv(
    "GEMINI_WEB2API_BASE_URL",
    "http://127.0.0.1:8081/v1"
)

GEMINI_API_KEY = os.getenv(
    "GEMINI_WEB2API_API_KEY",
    "sk-gemini"
)

GEMINI_MODEL = os.getenv(
    "GEMINI_WEB2API_MODEL",
    "gemini-3.6-flash"
)


async def gemini_chat(message: str) -> str:
    url = f"{GEMINI_BASE_URL}/chat/completions"

    payload = {
        "model": GEMINI_MODEL,
        "messages": [
            {
                "role": "user",
                "content": message
            }
        ]
    }

    headers = {
        "Authorization": f"Bearer {GEMINI_API_KEY}",
        "Content-Type": "application/json"
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            url,
            json=payload,
            headers=headers
        )

    response.raise_for_status()

    data = response.json()

    return data["choices"][0]["message"]["content"]