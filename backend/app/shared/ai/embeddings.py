import asyncio
import random
from typing import Any
import httpx
import structlog

from app.config import settings
from app.shared.ai.interfaces import IEmbeddingProvider

logger = structlog.get_logger("app.shared.ai.embeddings")

DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
DEFAULT_MODEL = "models/gemini-embedding-001"
DEFAULT_DIMENSIONS = 768


class EmbeddingError(Exception):
    """Raised when an embedding provider fails to generate vectors."""

    def __init__(self, message: str, status_code: int | None = None, details: Any = None):
        super().__init__(message)
        self.status_code = status_code
        self.details = details


class GeminiEmbeddingClient(IEmbeddingProvider):
    """Asynchronous client for Google Gemini text embeddings using pure httpx."""

    def __init__(
        self,
        api_key: str,
        base_url: str = DEFAULT_GEMINI_BASE_URL,
        model: str = DEFAULT_MODEL,
        dimensions: int = DEFAULT_DIMENSIONS,
        timeout: float = 10.0,
        max_retries: int = 3,
    ) -> None:
        self.api_key = api_key.strip().strip('"').strip("'")
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.dimensions = dimensions
        self.timeout = timeout
        self.max_retries = max_retries

    async def _request_with_retry(
        self,
        client: httpx.AsyncClient,
        url: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        """Executes HTTP POST request with jittered exponential backoff on 429/503/network errors."""
        headers = {"Content-Type": "application/json"}
        params = {"key": self.api_key}

        last_exc: Exception | None = None

        for attempt in range(self.max_retries + 1):
            try:
                response = await client.post(
                    url,
                    params=params,
                    json=payload,
                    headers=headers,
                    timeout=self.timeout,
                )

                if response.status_code == 200:
                    return response.json()

                # Retry on rate limiting (429) or transient server errors (503)
                if response.status_code in (429, 503) and attempt < self.max_retries:
                    backoff = (2 ** attempt) * 1.0 + random.uniform(0.1, 0.5)
                    logger.warn(
                        "gemini_rate_limit_retry",
                        status_code=response.status_code,
                        attempt=attempt + 1,
                        backoff_seconds=round(backoff, 2),
                    )
                    await asyncio.sleep(backoff)
                    continue

                error_body = response.text
                logger.error(
                    "gemini_embedding_failed",
                    status_code=response.status_code,
                    response=error_body,
                )
                raise EmbeddingError(
                    f"Gemini embedding API error: {response.status_code} - {error_body}",
                    status_code=response.status_code,
                    details=error_body,
                )

            except (httpx.TimeoutException, httpx.NetworkError) as exc:
                last_exc = exc
                if attempt < self.max_retries:
                    backoff = (2 ** attempt) * 1.0 + random.uniform(0.1, 0.5)
                    logger.warn(
                        "gemini_network_retry",
                        error=str(exc),
                        attempt=attempt + 1,
                        backoff_seconds=round(backoff, 2),
                    )
                    await asyncio.sleep(backoff)
                else:
                    logger.error("gemini_network_error_exhausted", error=str(exc))
                    raise EmbeddingError(f"Gemini embedding network failure: {exc}") from exc

        if last_exc:
            raise EmbeddingError(f"Gemini embedding request failed: {last_exc}") from last_exc

        raise EmbeddingError("Gemini embedding request failed unexpectedly")

    async def embed_text(self, text: str) -> list[float]:
        """Generates an embedding vector for a single string."""
        url = f"{self.base_url}/{self.model}:embedContent"
        payload = {
            "model": self.model,
            "content": {"parts": [{"text": text}]},
            "outputDimensionality": self.dimensions,
        }

        async with httpx.AsyncClient() as client:
            data = await self._request_with_retry(client, url, payload)

        values = data.get("embedding", {}).get("values", [])
        if not values:
            raise EmbeddingError("No embedding values returned in response", details=data)

        if len(values) != self.dimensions:
            logger.warn(
                "gemini_dimension_mismatch",
                expected=self.dimensions,
                actual=len(values),
            )

        return values

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Generates embedding vectors for a batch of strings."""
        if not texts:
            return []

        url = f"{self.base_url}/{self.model}:batchEmbedContents"
        payload = {
            "requests": [
                {
                    "model": self.model,
                    "content": {"parts": [{"text": text}]},
                    "outputDimensionality": self.dimensions,
                }
                for text in texts
            ]
        }

        async with httpx.AsyncClient() as client:
            data = await self._request_with_retry(client, url, payload)

        embeddings_data = data.get("embeddings", [])
        results: list[list[float]] = []

        for idx, item in enumerate(embeddings_data):
            vals = item.get("values", [])
            if not vals:
                raise EmbeddingError(f"Empty embedding for batch item {idx}", details=data)
            results.append(vals)

        return results


class MockEmbeddingProvider(IEmbeddingProvider):
    """Deterministic mock embedding provider returning fixed-dimension zero vectors."""

    def __init__(self, dimensions: int = DEFAULT_DIMENSIONS) -> None:
        self.dimensions = dimensions

    async def embed_text(self, text: str) -> list[float]:
        return [0.0] * self.dimensions

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        return [[0.0] * self.dimensions for _ in texts]


def get_embedding_client(
    api_key: str | None = None,
    provider: str | None = None,
    dimensions: int | None = None,
) -> IEmbeddingProvider:
    """Factory creating the appropriate embedding client according to configuration."""
    active_provider = (provider or settings.EMBEDDING_PROVIDER).lower()
    dims = dimensions or settings.EMBEDDING_DIMENSIONS
    key = api_key or settings.clean_gemini_api_key

    if active_provider == "mock" or not key:
        logger.info("using_mock_embedding_provider", dimensions=dims)
        return MockEmbeddingProvider(dimensions=dims)

    return GeminiEmbeddingClient(
        api_key=key,
        dimensions=dims,
    )
