from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class IEmbeddingProvider(Protocol):
    """Protocol defining the contract for text embedding generation."""

    async def embed_text(self, text: str) -> list[float]:
        """Embeds a single text string into a float vector."""
        ...

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Embeds multiple text strings into a list of float vectors."""
        ...


@runtime_checkable
class ILLMProvider(Protocol):
    """Protocol defining the contract for LLM completion in JSON mode."""

    async def complete_json(
        self,
        system_prompt: str,
        user_prompt: str,
        response_schema: type,
    ) -> Any:
        """Executes LLM chat completion with forced JSON response parsed into response_schema."""
        ...

