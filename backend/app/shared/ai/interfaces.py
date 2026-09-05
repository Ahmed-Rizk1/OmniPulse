from typing import Protocol, runtime_checkable


@runtime_checkable
class IEmbeddingProvider(Protocol):
    """Protocol defining the contract for text embedding generation."""

    async def embed_text(self, text: str) -> list[float]:
        """Embeds a single text string into a float vector."""
        ...

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Embeds multiple text strings into a list of float vectors."""
        ...
