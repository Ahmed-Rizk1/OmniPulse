import re
import urllib.parse
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    SUPABASE_DB_URL: str = Field(..., description="Supabase Postgres connection URL")
    REDIS_URL: str = Field(..., description="Redis connection URL")
    APP_ENV: str = Field(..., description="Application environment (development, production, etc.)")
    GEMINI_API_KEY: str = Field(..., description="Google Gemini API key for text embeddings")
    EMBEDDING_PROVIDER: str = Field(default="gemini", description="Embedding provider: gemini | mock")
    EMBEDDING_DIMENSIONS: int = Field(default=768, description="Embedding vector dimensions")
    GROQ_API_KEY: str = Field(..., description="Groq API key for fast triage tier")
    GROQ_MODEL: str = Field(default="openai/gpt-oss-20b", description="Groq LLM model for fast triage")
    TRIAGE_CONFIDENCE_THRESHOLD: float = Field(default=0.85, description="Confidence threshold for Tier 1 triage")

    @property
    def clean_gemini_api_key(self) -> str:
        """Returns the Gemini API key stripped of any surrounding whitespace or quotes."""
        return self.GEMINI_API_KEY.strip().strip('"').strip("'")

    @property
    def clean_groq_api_key(self) -> str:
        """Returns the Groq API key stripped of any surrounding whitespace or quotes."""
        return self.GROQ_API_KEY.strip().strip('"').strip("'")


    @property
    def async_supabase_db_url(self) -> str:
        """Returns the Supabase DB URL normalized for asyncpg and safely URL-encoded."""
        url = self.SUPABASE_DB_URL.strip()
        match = re.match(
            r"^(?P<scheme>[a-zA-Z0-9_+]+)://(?P<user>[^:]+):(?P<password>[^@]+)@(?P<rest>.+)$",
            url,
        )
        if match:
            scheme = match.group("scheme")
            user = match.group("user")
            password = match.group("password")
            rest = match.group("rest")
            unquoted_pw = urllib.parse.unquote(password)
            quoted_pw = urllib.parse.quote(unquoted_pw, safe="")
            url = f"{scheme}://{user}:{quoted_pw}@{rest}"

        if url.startswith("postgresql://"):
            url = "postgresql+asyncpg://" + url[len("postgresql://") :]
        elif url.startswith("postgres://"):
            url = "postgresql+asyncpg://" + url[len("postgres://") :]

        return url


settings = Settings()
