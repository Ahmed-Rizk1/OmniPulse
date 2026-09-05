import asyncio
import json
import random
from typing import Any, TypeVar
import httpx
from pydantic import BaseModel
import structlog

from app.config import settings
from app.shared.ai.interfaces import ILLMProvider

logger = structlog.get_logger("app.shared.ai.groq")

T = TypeVar("T", bound=BaseModel)

DEFAULT_GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b"
FALLBACK_GROQ_MODELS = ["openai/gpt-oss-20b", "groq/compound-mini", "llama-3.1-8b-instant"]


class LLMError(Exception):
    """Raised when an LLM provider fails to complete a request or validate output."""

    def __init__(self, message: str, status_code: int | None = None, details: Any = None):
        super().__init__(message)
        self.status_code = status_code
        self.details = details


class GroqLLMProvider(ILLMProvider):
    """Pure httpx async client for Groq LLM completions in strict JSON mode."""

    def __init__(
        self,
        api_key: str,
        model: str = DEFAULT_GROQ_MODEL,
        api_url: str = DEFAULT_GROQ_API_URL,
        timeout: float = 10.0,
        max_retries: int = 3,
    ) -> None:
        self.api_key = api_key.strip().strip('"').strip("'")
        self.model = model
        self.api_url = api_url
        self.timeout = timeout
        self.max_retries = max_retries

    async def _execute_chat_completion(
        self,
        client: httpx.AsyncClient,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        last_exc: Exception | None = None

        for attempt in range(self.max_retries + 1):
            try:
                response = await client.post(
                    self.api_url,
                    headers=headers,
                    json=payload,
                    timeout=self.timeout,
                )

                if response.status_code == 200:
                    return response.json()

                # If the requested model is not found, attempt fallback to available Groq models
                if response.status_code == 404 and "model_not_found" in response.text:
                    for fallback in FALLBACK_GROQ_MODELS:
                        if fallback != payload.get("model"):
                            logger.warn("groq_model_fallback", old_model=payload.get("model"), new_model=fallback)
                            payload["model"] = fallback
                            break
                    continue

                # Jittered exponential backoff on rate limits or transient 503
                if response.status_code in (429, 503) and attempt < self.max_retries:
                    backoff = (2 ** attempt) * 1.0 + random.uniform(0.1, 0.5)
                    logger.warn(
                        "groq_rate_limit_retry",
                        status_code=response.status_code,
                        attempt=attempt + 1,
                        backoff_seconds=round(backoff, 2),
                    )
                    await asyncio.sleep(backoff)
                    continue

                error_body = response.text
                logger.error("groq_api_error", status_code=response.status_code, response=error_body)
                raise LLMError(
                    f"Groq API error {response.status_code}: {error_body}",
                    status_code=response.status_code,
                    details=error_body,
                )

            except (httpx.TimeoutException, httpx.NetworkError) as exc:
                last_exc = exc
                if attempt < self.max_retries:
                    backoff = (2 ** attempt) * 1.0 + random.uniform(0.1, 0.5)
                    logger.warn(
                        "groq_network_retry",
                        error=str(exc),
                        attempt=attempt + 1,
                        backoff_seconds=round(backoff, 2),
                    )
                    await asyncio.sleep(backoff)
                else:
                    logger.error("groq_network_error_exhausted", error=str(exc))
                    raise LLMError(f"Groq network failure: {exc}") from exc

        if last_exc:
            raise LLMError(f"Groq request failed: {last_exc}") from last_exc

        raise LLMError("Groq request failed unexpectedly")

    async def complete_json(
        self,
        system_prompt: str,
        user_prompt: str,
        response_schema: type[T],
    ) -> T:
        """Invokes Groq chat completion with JSON mode and parses the response into response_schema."""
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0,
        }

        async with httpx.AsyncClient() as client:
            result = await self._execute_chat_completion(client, payload)

        try:
            choices = result.get("choices", [])
            if not choices:
                raise LLMError("No completion choices returned by Groq", details=result)

            raw_content = choices[0].get("message", {}).get("content", "{}")
            parsed_json = json.loads(raw_content)
            return response_schema.model_validate(parsed_json)
        except Exception as exc:
            logger.error("groq_schema_validation_failed", error=str(exc), response=result)
            raise LLMError(f"Failed to validate Groq JSON against schema: {exc}", details=result) from exc


class MockLLMProvider(ILLMProvider):
    """Deterministic mock LLM provider for local testing without API key."""

    async def complete_json(
        self,
        system_prompt: str,
        user_prompt: str,
        response_schema: type[T],
    ) -> T:
        dummy_data = {
            "category": "billing",
            "priority": "high",
            "summary": "Mock triage summary",
            "suggested_action": "Mock verification action",
            "confidence": 0.95,
            "reasoning": "Mock deterministic reasoning",
            "needs_fallback": False,
        }
        return response_schema.model_validate(dummy_data)


def get_groq_provider(
    api_key: str | None = None,
    model: str | None = None,
) -> ILLMProvider:
    """Factory creating the Groq LLM provider or mock fallback."""
    key = api_key or settings.clean_groq_api_key
    selected_model = model or settings.GROQ_MODEL

    if not key:
        logger.info("using_mock_llm_provider")
        return MockLLMProvider()

    return GroqLLMProvider(
        api_key=key,
        model=selected_model,
    )
