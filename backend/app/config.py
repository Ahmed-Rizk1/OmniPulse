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
