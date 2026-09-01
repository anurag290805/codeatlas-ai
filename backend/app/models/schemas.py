"""Pydantic request and response contracts for the CodeAtlas API."""

from __future__ import annotations

import re
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator

_GITHUB_URL_PATTERN = re.compile(
    r"^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+(?:\.git)?/?$"
)


class RepositoryStatus(str, Enum):
    READY = "ready"
    INDEXING = "indexing"
    DISCOVERING_FILES = "discovering_files"
    CHUNKING = "chunking"
    STORING = "storing"
    INDEX_FAILED = "index_failed"
    FAILED_IMPORT = "failed_import"
    DELETING = "deleting"
    # Legacy values kept in the wire contract for older clients.
    PENDING = "pending"
    CLONING = "cloning"
    PARSING = "parsing"
    EMBEDDING = "embedding"
    INDEXED = "indexed"
    FAILED = "failed"


IndexingStatus = RepositoryStatus


class IndexingStage(str, Enum):
    QUEUED = "queued"
    CLONING = "cloning"
    DISCOVERING = "discovering"
    CHUNKING = "chunking"
    EMBEDDING = "embedding"
    STORING = "storing"
    COMPLETED = "completed"
    FAILED = "failed"


class RepositoryCreate(BaseModel):
    """Request to register a public GitHub repository."""

    url: str = Field(min_length=1)
    branch: str | None = None

    @field_validator("url")
    @classmethod
    def validate_url(cls, value: str) -> str:
        value = value.strip()
        if not _GITHUB_URL_PATTERN.fullmatch(value):
            raise ValueError("url must be a valid public GitHub repository URL")
        return value

    @field_validator("branch")
    @classmethod
    def validate_branch(cls, value: str | None) -> str | None:
        if value is not None and not value.strip():
            raise ValueError("branch must not be blank")
        return value.strip() if value else value


RepositoryImportRequest = RepositoryCreate


class RepositoryResponse(BaseModel):
    """Repository metadata returned by lifecycle endpoints."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    repository_name: str
    url: str
    default_branch: str = "main"
    status: RepositoryStatus = RepositoryStatus.PENDING
    stage: IndexingStage = IndexingStage.QUEUED
    progress_percent: float = Field(default=0, ge=0, le=100)
    files_indexed: int = Field(default=0, ge=0)
    chunks_generated: int = Field(default=0, ge=0)
    embeddings_generated: int = Field(default=0, ge=0)
    processed_files: int = Field(default=0, ge=0)
    processed_chunks: int = Field(default=0, ge=0)
    processed_embeddings: int = Field(default=0, ge=0)
    estimated_seconds_remaining: int | None = Field(default=None, ge=0)
    last_indexed_at: datetime | None = None
    indexing_started_at: datetime | None = None
    completed_at: datetime | None = None
    error_message: str | None = None

    @field_validator("default_branch", mode="before")
    @classmethod
    def default_branch_value(cls, value: str | None) -> str:
        return value or "main"

    @property
    def repository_id(self) -> int:
        return self.id


class RepositoryStatusResponse(RepositoryResponse):
    """Repository indexing state and progress."""

    pass


class RepositoryListResponse(BaseModel):
    items: list[RepositoryResponse]
    total: int = Field(ge=0)
    skip: int = Field(default=0, ge=0)
    limit: int = Field(default=50, ge=1)


class RepositoryHealthResponse(BaseModel):
    total_repositories: int = Field(ge=0)
    indexed: int = Field(ge=0)
    failed: int = Field(ge=0)
    pending: int = Field(ge=0)


class GithubIntelligenceResponse(BaseModel):
    available: bool
    message: str | None = None
    full_name: str | None = None
    description: str | None = None
    stars: int = 0
    forks: int = 0
    watchers: int = 0
    open_issues: int = 0
    default_branch: str | None = None
    license: str | None = None
    html_url: str | None = None


class DependencyResponse(BaseModel):
    ecosystem: str
    name: str
    installed_version: str | None = None
    requested_version: str | None = None
    latest_version: str | None = None
    description: str | None = None
    dependency_type: str
    source_file: str
    status: str = "unknown"
    vulnerabilities: list["VulnerabilityResponse"] = Field(default_factory=list)


class DependenciesResponse(BaseModel):
    available: bool
    message: str | None = None
    checked_at: datetime
    dependencies: list[DependencyResponse] = Field(default_factory=list)


class VulnerabilityResponse(BaseModel):
    id: str
    summary: str | None = None
    severity: str = "Unknown"
    affected_versions: list[str] = Field(default_factory=list)
    fixed_versions: list[str] = Field(default_factory=list)
    references: list[str] = Field(default_factory=list)
    ecosystem: str
    package: str
    installed_version: str


class SecurityResponse(BaseModel):
    available: bool
    message: str | None = None
    checked_at: datetime
    dependencies_scanned: int = 0
    severity_counts: dict[str, int] = Field(default_factory=dict)
    vulnerabilities: list[VulnerabilityResponse] = Field(default_factory=list)


DependencyResponse.model_rebuild()


RepositoryImportResponse = RepositoryResponse


class CitationSchema(BaseModel):
    file_path: str
    start_line: int = Field(ge=1)
    end_line: int = Field(ge=1)
    symbol_name: str | None = None

    @field_validator("end_line")
    @classmethod
    def validate_range(cls, value: int, info) -> int:
        start = info.data.get("start_line")
        if start is not None and value < start:
            raise ValueError("end_line must be greater than or equal to start_line")
        return value


Citation = CitationSchema


class QueryRequest(BaseModel):
    repository_id: int
    query: str = Field(min_length=1)
    top_k: int = Field(default=5, ge=1, le=20)

    @field_validator("query")
    @classmethod
    def validate_query(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("query must not be blank")
        return value

    @property
    def question(self) -> str:
        return self.query


class RepositoryScopedQueryRequest(BaseModel):
    query: str = Field(min_length=1)
    top_k: int = Field(default=5, ge=1, le=20)

    @field_validator("query")
    @classmethod
    def validate_query(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("query must not be blank")
        return value


class TokenUsageSchema(BaseModel):
    prompt_tokens: int = Field(ge=0)
    completion_tokens: int = Field(ge=0)
    total_tokens: int = Field(ge=0)


class QueryResponse(BaseModel):
    repository_id: str | int
    query: str
    answer: str
    citations: list[CitationSchema] = Field(default_factory=list)
    provider: str
    model: str
    latency_seconds: float = Field(ge=0)
    token_usage: TokenUsageSchema | None = None


class QueryHealthResponse(BaseModel):
    status: str
    retriever_ready: bool
    rag_status: str = "ready"
    provider_status: str = "unavailable"
    provider_configured: bool = False
    provider_healthy: bool = False
    model_available: bool
    llm_provider: str = "gemini"
    llm_model: str
    message: str


class RepositoryFileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    relative_path: str
    language: str | None = None
    file_size_bytes: int
    checksum_sha256: str
    chunks_generated: int


class RepositoryFilesResponse(BaseModel):
    files: list[RepositoryFileResponse]


class RepositoryFileContentResponse(BaseModel):
    """Content of a single file from a repository."""

    path: str
    content: str
    language: str | None = None
    size_bytes: int = Field(ge=0)


# Names retained for callers that used the earlier schema vocabulary.
QueryRequest.model_rebuild()
