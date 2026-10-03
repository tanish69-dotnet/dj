import os

import httpx

_DUMMY_KEYS = {"", "sk-gemini", "dummy", "test", "changeme"}
_DUMMY_URLS = {"", "http://127.0.0.1:8081/v1", "http://localhost:8081/v1", "http://0.0.0.0:8081/v1"}
_DEFAULT_MODEL = "gemini-2.0-flash"


def _env(name: str) -> str:
    return (os.getenv(name) or "").strip()


def gemini_base_url() -> str:
    return _env("GEMINI_WEB2API_BASE_URL")


def gemini_api_key() -> str:
    return _env("GEMINI_WEB2API_API_KEY")


def gemini_model() -> str:
    return _env("GEMINI_WEB2API_MODEL") or _DEFAULT_MODEL


def _base_url_usable(url: str) -> bool:
    if not url or url.lower() in _DUMMY_URLS:
        return False
    lowered = url.lower()
    # A loopback/placeholder URL cannot be reached from the deployed container.
    return not (lowered.startswith("http://127.0.0.1") or lowered.startswith("http://localhost") or lowered.startswith("http://0.0.0.0"))


def _api_key_usable(key: str) -> bool:
    return bool(key) and key.lower() not in _DUMMY_KEYS


def is_gemini_configured() -> bool:
    return _base_url_usable(gemini_base_url()) and _api_key_usable(gemini_api_key())


def gemini_config_status() -> dict:
    base_url = gemini_base_url()
    api_key = gemini_api_key()
    return {
        "configured": _base_url_usable(base_url) and _api_key_usable(api_key),
        "base_url_set": _base_url_usable(base_url),
        "api_key_set": _api_key_usable(api_key),
        "model": gemini_model(),
    }


async def gemini_chat(message: str) -> str:
    if not is_gemini_configured():
        raise RuntimeError(
            "AI provider is not configured. Set GEMINI_WEB2API_BASE_URL and "
            "GEMINI_WEB2API_API_KEY on the server."
        )

    url = f"{gemini_base_url().rstrip('/')}/chat/completions"
    payload = {
        "model": gemini_model(),
        "messages": [{"role": "user", "content": message}],
    }
    headers = {
        "Authorization": f"Bearer {gemini_api_key()}",
        "Content-Type": "application/json",
    }
    # Fail fast on connect so the caller can fall back to the deterministic
    # advisor instead of holding the request open for the full read budget.
    timeout = httpx.Timeout(connect=5.0, read=25.0, write=10.0, pool=5.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(url, json=payload, headers=headers)
    response.raise_for_status()

    data = response.json()
    content = None
    if isinstance(data, dict):
        try:
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError):
            content = data.get("reply") or data.get("response") or data.get("content")
    if content:
        return str(content)
    raise RuntimeError("AI provider returned an empty or unrecognized response.")