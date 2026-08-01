"""Pydantic Settings configuration for CodeAtlas AI."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Annotated
from urllib.parse import urlparse

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_PROJECT_ROOT = Path(__file__).resolve().parents[3]
_DATA_DIR = _PROJECT_ROOT / "data"


class Settings(BaseSettings):
    """Validated application configuration loaded from ``.env`` and env vars."""

    model_config = SettingsConfigDict(
        env_file=_PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        validate_default=True,
    )

    # Application
    app_name: str = Field(default="CodeAtlas AI", min_length=1)
    app_version: str = Field(default="0.1.0", min_length=1)
    app_description: str = Field(default="AI-powered code intelligence platform.")
    environment: str = Field(default="development", min_length=1)
    debug: bool = False
    host: str = Field(default="127.0.0.1", min_length=1)
    port: Annotated[int, Field(ge=1, le=65_535)] = 8000
    api_prefix: str = "/api"
    cors_allowed_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])
    cors_allow_credentials: bool = True
    trusted_hosts: list[str] = Field(default_factory=list)

    # Database
    database_url: str = Field(
        default=f"sqlite:///{(_DATA_DIR / 'app.db').as_posix()}", min_length=1
    )

    # Ollama
    ollama_base_url: str = Field(
        default="http://localhost:11434",
        validation_alias=AliasChoices("OLLAMA_BASE_URL", "OLLAMA_HOST"),
    )
    ollama_model: str = Field(default="llama3.2:1b", min_length=1)
    ollama_timeout_seconds: Annotated[float, Field(gt=0)] = 120.0
    ollama_temperature: Annotated[float, Field(ge=0, le=2)] = 0.0
    ollama_max_tokens: Annotated[int, Field(gt=0)] = 2_048

    # Embeddings
    embedding_provider: str = Field(default="sentence_transformers", min_length=1)
    embedding_model: str = Field(default="BAAI/bge-small-en-v1.5", min_length=1)
    embedding_batch_size: Annotated[int, Field(gt=0)] = 32
    embedding_max_input_tokens: Annotated[int, Field(gt=0)] = 256

    # Logging
    log_level: str = "INFO"
    log_file: Path = _PROJECT_ROOT / "logs" / "app.log"

    # ChromaDB
    chroma_persist_directory: Path = Field(
        default=_DATA_DIR / "vector_store",
        validation_alias=AliasChoices("CHROMA_PERSIST_DIRECTORY", "CHROMA_DB_PATH"),
    )
    chroma_collection_prefix: str = Field(default="codeatlas_repo", min_length=1)

    # Shared service limits
    retrieval_top_k: Annotated[int, Field(gt=0, le=200)] = 5
    retrieval_token_budget: Annotated[int, Field(gt=0)] = 4_000
    graph_max_traversal_depth: Annotated[int, Field(gt=0, le=100)] = 10

    @field_validator("environment", "embedding_provider", mode="before")
    @classmethod
    def normalize_identifier(cls, value: str) -> str:
        normalized = str(value).strip().lower()
        if not normalized:
            raise ValueError("value must not be empty")
        return normalized

    @field_validator("log_level", mode="before")
    @classmethod
    def validate_log_level(cls, value: str) -> str:
        normalized = str(value).strip().upper()
        if normalized not in {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}:
            raise ValueError("log_level must be DEBUG, INFO, WARNING, ERROR, or CRITICAL")
        return normalized

    @field_validator("ollama_base_url", mode="before")
    @classmethod
    def validate_ollama_base_url(cls, value: str) -> str:
        url = str(value).strip().rstrip("/")
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("ollama_base_url must be a valid HTTP or HTTPS URL")
        return url

    @field_validator("api_prefix", mode="before")
    @classmethod
    def normalize_api_prefix(cls, value: str) -> str:
        prefix = str(value).strip()
        if not prefix:
            raise ValueError("api_prefix must not be empty")
        return "/" + prefix.strip("/") if prefix != "/" else ""

    @field_validator("cors_allowed_origins", "trusted_hosts", mode="before")
    @classmethod
    def parse_csv_values(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return [str(item).strip() for item in value if str(item).strip()]

    @field_validator("database_url", mode="before")
    @classmethod
    def validate_database_url(cls, value: str) -> str:
        url = str(value).strip()
        if "://" not in url:
            raise ValueError("database_url must be a valid SQLAlchemy URL")
        return url

    @field_validator("log_file", "chroma_persist_directory", mode="before")
    @classmethod
    def resolve_path(cls, value: str | Path) -> Path:
        return Path(value).expanduser().resolve()

    # Compatibility properties for existing modules using the old names.
    @property
    def LOG_LEVEL(self) -> str:
        return self.log_level

    @property
    def LOG_FILE(self) -> Path:
        return self.log_file

    @property
    def TREE_SITTER_LANGUAGES_DIR(self) -> Path:
        return _DATA_DIR / "tree_sitter_languages"

    @property
    def REPOSITORIES_DIR(self) -> Path:
        return _DATA_DIR / "repos"

    @property
    def DATABASE_URL(self) -> str:
        return self.database_url


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the process-wide singleton settings instance."""
    return Settings()


settings = get_settings()
