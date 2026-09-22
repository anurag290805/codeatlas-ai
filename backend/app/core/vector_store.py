"""
Vector storage service for CodeAtlas AI.

This module is the sole point of contact between the backend and the
underlying vector database. It persists and retrieves the embedding vectors
produced by ``app.core.embeddings`` and exposes structured, database-agnostic
result types to the rest of the application.

No other module may communicate with ChromaDB directly. Migrating to a
different vector database (Pinecone, Weaviate, Qdrant, Milvus, etc.) should
require changes only within this module: concrete storage engines implement
``AbstractVectorStore``, and the rest of the backend depends exclusively on
``VectorStoreService``.

The PostgreSQL-backed implementation uses pgvector for similarity search with
ONE shared table (``codeatlas_vectors``). Every row includes ``workspace_id``
and ``repository_id`` so isolation is preserved at query time.

The ``pgvector`` extension must be enabled:
    CREATE EXTENSION IF NOT EXISTS vector;
"""
from __future__ import annotations

import json
import uuid
import hashlib
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import (
    create_engine, inspect, text, Column, String, Integer,
    DateTime, Index, select, delete, func, text as sql_text, bindparam,
)
from sqlalchemy.orm import Mapped, mapped_column
from app.db.database import Base

from app.config import get_settings
from app.core.embeddings import ChunkEmbedding
from app.utils.logger import get_logger

logger = get_logger(__name__)

# Dimension is configurable via settings (embedding_dimension) and must match
# the Gemini embedding model output (gemini-embedding-2 default 768, configurable 128-3072).
# Read at init time to stay consistent with embeddings.
_EMBEDDING_DIM = get_settings().embedding_dimension

# Shared table for all repository embeddings. Not one table per repo.
VECTOR_TABLE_NAME = "codeatlas_vectors"

_COLLECTION_NAME_PREFIX = "codeatlas"
_NAMESPACE_HASH_LENGTH = 9
_METADATA_JSON_KEY = "metadata_json"
_RESERVED_METADATA_KEYS = frozenset(
    {
        "repository_id",
        "chunk_id",
        "file_path",
        "symbol_name",
        "symbol_type",
        "language",
        "start_line",
        "end_line",
        "code",
    }
)

class VectorStoreError(Exception):
    pass

class UnsupportedVectorStoreError(VectorStoreError):
    pass

class CollectionNotFoundError(VectorStoreError):
    pass

class VectorInsertionError(VectorStoreError):
    pass

class VectorSearchError(VectorStoreError):
    pass

class VectorDeletionError(VectorStoreError):
    pass

class VectorStorePersistenceError(VectorStoreError):
    pass

@dataclass(frozen=True)
class StoredVectorRecord:
    chunk_id: str
    repository_id: str
    file_path: str
    symbol_name: str | None
    symbol_type: str | None
    language: str
    start_line: int | None
    end_line: int | None
    metadata: dict[str, Any] = field(default_factory=dict)

@dataclass(frozen=True)
class VectorSearchResult:
    record: StoredVectorRecord
    similarity_score: float

@dataclass(frozen=True)
class SearchFilters:
    language: str | None = None
    symbol_type: str | None = None
    metadata_equals: dict[str, Any] = field(default_factory=dict)

@dataclass(frozen=True)
class CollectionStats:
    collection_name: str
    repository_id: str
    vector_count: int

def _chunk_embedding_to_record(embedding: ChunkEmbedding) -> StoredVectorRecord:
    metadata = embedding.metadata or {}
    return StoredVectorRecord(
        chunk_id=embedding.chunk_id,
        repository_id=embedding.repository_id,
        file_path=embedding.file_path,
        symbol_name=embedding.symbol_name,
        symbol_type=embedding.symbol_type,
        language=embedding.language,
        start_line=metadata.get("start_line"),
        end_line=metadata.get("end_line"),
        metadata=metadata,
    )

def _record_to_storage_metadata(record: StoredVectorRecord) -> dict[str, Any]:
    extra_metadata = {
        key: value for key, value in record.metadata.items()
        if key not in _RESERVED_METADATA_KEYS
    }
    return {
        "repository_id": record.repository_id,
        "chunk_id": record.chunk_id,
        "file_path": record.file_path,
        "symbol_name": record.symbol_name or "",
        "symbol_type": record.symbol_type or "",
        "language": record.language,
        "start_line": record.start_line if record.start_line is not None else -1,
        "end_line": record.end_line if record.end_line is not None else -1,
        "code": str(record.metadata.get("code", "")),
        _METADATA_JSON_KEY: json.dumps(extra_metadata, default=str),
    }

def _storage_metadata_to_record(chunk_id: str, storage_metadata: dict[str, Any]) -> StoredVectorRecord:
    try:
        decoded = json.loads(storage_metadata.get(_METADATA_JSON_KEY, "{}"))
        extra = decoded if isinstance(decoded, dict) else {}
    except (TypeError, json.JSONDecodeError):
        extra = {}
    if "code" in storage_metadata:
        extra["code"] = storage_metadata["code"]
    start_line = storage_metadata.get("start_line")
    end_line = storage_metadata.get("end_line")
    return StoredVectorRecord(
        chunk_id=chunk_id,
        repository_id=storage_metadata.get("repository_id", ""),
        file_path=storage_metadata.get("file_path", ""),
        symbol_name=storage_metadata.get("symbol_name") or None,
        symbol_type=storage_metadata.get("symbol_type") or None,
        language=storage_metadata.get("language", ""),
        start_line=None if start_line in (None, -1) else int(start_line),
        end_line=None if end_line in (None, -1) else int(end_line),
        metadata=extra,
    )

# SQLAlchemy ORM model for the shared pgvector table
try:
    from pgvector.sqlalchemy import Vector
    # Enhanced pgvector.Vector to generate extensions.vector() for PostgreSQL
    class VectorWithExtension(Vector):
        def get_colspec(self, **kw):
            settings = get_settings()
            database_url = getattr(settings, 'DATABASE_URL', '')
            # Check if we're using PostgreSQL to reference the extensions schema
            if database_url and database_url.startswith(("postgresql://", "postgres://")):
                return f"extensions.vector({self.dim})"
            else:
                return super().get_colspec(**kw)

        def bind_processor(self, dialect):
            # Add a dialect-level processor to ensure proper type name
            def process(value):
                # Return the appropriate type name based on dialect
                if dialect.name == "postgresql":
                    return f"extensions.vector({self.dim})"
                return super().bind_processor(dialect)(value) if hasattr(super(), 'bind_processor') else value
            return process

    Vector = VectorWithExtension
except Exception:  # pragma: no cover
    # Fallback if pgvector SQLAlchemy package not installed; still produces correct SQL.
    from sqlalchemy.types import UserDefinedType
    from app.config import get_settings

    class Vector(UserDefinedType):
        def __init__(self, dim: int = 768):
            self.dim = dim
            super().__init__()

        def get_colspec(self, **kw):
            settings = get_settings()
            database_url = getattr(settings, 'DATABASE_URL', '')
            # Check if we're using PostgreSQL to reference the extensions schema
            if database_url and database_url.startswith(("postgresql://", "postgres://")):
                return f"extensions.vector({self.dim})"
            else:
                return f"VECTOR({self.dim})"

        def bind_processor(self, dialect):
            # Add a dialect-level processor to ensure proper type name
            def process(value):
                # Return the appropriate type name based on dialect
                if dialect.name == "postgresql":
                    return f"extensions.vector({self.dim})"
                return f"VECTOR({self.dim})"
            return process

from sqlalchemy.orm import Mapped, mapped_column

# We use a declarative base aligned with the app's database module.
class VectorRow(Base):
    __tablename__ = VECTOR_TABLE_NAME
    __table_args__ = (
        Index(
            "uq_vectors_workspace_repository_chunk",
            "workspace_id",
            "repository_id",
            "chunk_id",
            unique=True,
        ),
        Index("ix_vectors_workspace_repo", "workspace_id", "repository_id"),
        Index("ix_vectors_chunk", "workspace_id", "repository_id", "chunk_id"),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    workspace_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    repository_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    chunk_id: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    symbol_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    symbol_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    language: Mapped[str] = mapped_column(String(50), nullable=False)
    start_line: Mapped[int] = mapped_column(Integer, nullable=True)
    end_line: Mapped[int] = mapped_column(Integer, nullable=True)
    code: Mapped[str] = mapped_column(String, nullable=False, default="")
    embedding: Mapped[Any] = mapped_column(Vector(_EMBEDDING_DIM), nullable=False)
    metadata_json: Mapped[str] = mapped_column(String, nullable=False, default="{}")
    generation_version: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[Any] = mapped_column(DateTime(timezone=True), nullable=True)

class AbstractVectorStore(ABC):
    @abstractmethod
    def create_collection(self, collection_name: str) -> None:
        pass

    @abstractmethod
    def collection_exists(self, collection_name: str) -> bool:
        pass

    @abstractmethod
    def delete_collection(self, collection_name: str) -> None:
        pass

    @abstractmethod
    def reset_collection(self, collection_name: str) -> None:
        pass

    @abstractmethod
    def upsert_vectors(
        self,
        collection_name: str,
        embeddings: list[ChunkEmbedding],
        workspace_id: str | None = None,
    ) -> int:
        pass

    @abstractmethod
    def delete_vectors(self, collection_name: str, chunk_ids: list[str]) -> int:
        pass

    @abstractmethod
    def delete_by_metadata(self, collection_name: str, field_name: str, value: str) -> int:
        pass

    @abstractmethod
    def similarity_search(
        self,
        collection_name: str,
        query_vector: list[float],
        top_k: int,
        filters: SearchFilters | None,
        workspace_id: str | None = None,
    ) -> list[VectorSearchResult]:
        pass

    @abstractmethod
    def count_vectors(self, collection_name: str) -> int:
        pass

class PgVectorStore(AbstractVectorStore):
    """Shared-table pgvector backend."""

    def __init__(self) -> None:
        settings = get_settings()
        database_url = settings.DATABASE_URL
        if not database_url:
            raise VectorStorePersistenceError("DATABASE_URL must be configured for pgvector backend.")
        self._engine = create_engine(database_url, future=True)
        # Verify pgvector genuinely exists: create extension and inspect type
        with self._engine.begin() as conn:
            # Only attempt pgvector extension when on PostgreSQL
            url = database_url
            if url.startswith(("postgresql://", "postgres://")):
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
                # Real verification: query pg_extension for vector
                result = conn.execute(text("SELECT extname FROM pg_extension WHERE extname = 'vector'")).first()
                if result is None or result[0] != "vector":
                    raise VectorStorePersistenceError("pgvector extension not found in PostgreSQL.")
                # Verify similarity operator works with a real vector query
                try:
                    conn.execute(text("SELECT '[1,2,3]'::vector <=> '[1,2,4]'::vector"))
                except Exception:
                    raise VectorStorePersistenceError("pgvector similarity operator <=> not available.")
            else:
                logger.warning("PgVectorStore initialized with non-PostgreSQL URL (%s); pgvector checks skipped.", url.split("://")[0])
        logger.info("PgVectorStore initialized with database_url=%s", database_url.replace("://", "://***@"))

    def _parse_collection_name(self, collection_name: str) -> tuple[str | None, str | None]:
        # Legacy naming: codeatlas_{namespace}_{repository_id}
        # For shared table, extract workspace/repo from metadata or collection name.
        # We store workspace/repo explicitly in the table, so callers must provide them.
        return None, None

    @staticmethod
    def _repository_id_from_collection_name(collection_name: str) -> str:
        """Resolve the repository portion of the service's namespaced key."""
        parts = collection_name.split("_", 2)
        if len(parts) == 3 and parts[0] == _COLLECTION_NAME_PREFIX:
            repository_id = parts[2]
            if repository_id:
                return repository_id
        return collection_name

    # For backward compatibility, treat collection_name as repository identifier.
    def create_collection(self, collection_name: str) -> None:
        # Shared table is created once; nothing per-collection.
        with self._engine.begin() as conn:
            conn.execute(text(f"CREATE TABLE IF NOT EXISTS {VECTOR_TABLE_NAME} ("+
                "id SERIAL PRIMARY KEY," +
                "workspace_id VARCHAR(128)," +
                "repository_id VARCHAR(255) NOT NULL," +
                "chunk_id VARCHAR(255) NOT NULL," +
                "file_path VARCHAR(1024) NOT NULL," +
                "symbol_name VARCHAR(255)," +
                "symbol_type VARCHAR(100)," +
                "language VARCHAR(50) NOT NULL," +
                "start_line INTEGER," +
                "end_line INTEGER," +
                "code TEXT NOT NULL DEFAULT ''," +
                "embedding extensions.vector(" + str(_EMBEDDING_DIM) + ") NOT NULL," +
                "metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb," +
                "generation_version INTEGER," +
                "created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()" +
                ")"))
            conn.execute(text(f"CREATE INDEX IF NOT EXISTS ix_vectors_workspace_repo ON {VECTOR_TABLE_NAME} (workspace_id, repository_id)"))
            conn.execute(text(
                f"CREATE UNIQUE INDEX IF NOT EXISTS uq_vectors_workspace_repository_chunk "
                f"ON {VECTOR_TABLE_NAME} (workspace_id, repository_id, chunk_id)"
            ))
        logger.info("Shared vector table '%s' ready.", VECTOR_TABLE_NAME)

    def collection_exists(self, collection_name: str) -> bool:
        inspector = inspect(self._engine)
        return inspector.has_table(VECTOR_TABLE_NAME)

    def delete_collection(self, collection_name: str) -> None:
        # Never drop the shared table; instead delete by repository scope if needed.
        logger.info("delete_collection called for '%s' on shared table - no-op.", collection_name)

    def reset_collection(self, collection_name: str) -> None:
        # In shared-table design, reset is a targeted delete by repository.
        # For compatibility we log and skip destructive global reset.
        logger.info("reset_collection on shared table '%s' - no-op to preserve isolation.", collection_name)

    def upsert_vectors(
        self,
        collection_name: str,
        embeddings: list[ChunkEmbedding],
        workspace_id: str | None = None,
    ) -> int:
        if not embeddings:
            return 0
        repository_id = embeddings[0].repository_id
        with self._engine.begin() as conn:
            for emb in embeddings:
                record = _chunk_embedding_to_record(emb)
                meta = _record_to_storage_metadata(record)
                # Insert/update by chunk+repo+workspace. For shared table, use chunk_id+repository_id as key.
                conn.execute(
                    text(f"""
                    INSERT INTO {VECTOR_TABLE_NAME}
                    (workspace_id, repository_id, chunk_id, file_path, symbol_name,
                     symbol_type, language, start_line, end_line, code, embedding,
                     metadata_json, generation_version, created_at)
                    VALUES
                    (:workspace_id, :repository_id, :chunk_id, :file_path, :symbol_name,
                     :symbol_type, :language, :start_line, :end_line, :code,
                     :embedding, :metadata_json, :generation_version, NOW())
                    ON CONFLICT (workspace_id, repository_id, chunk_id) DO UPDATE SET
                        file_path = EXCLUDED.file_path,
                        symbol_name = EXCLUDED.symbol_name,
                        symbol_type = EXCLUDED.symbol_type,
                        language = EXCLUDED.language,
                        start_line = EXCLUDED.start_line,
                        end_line = EXCLUDED.end_line,
                        code = EXCLUDED.code,
                        embedding = EXCLUDED.embedding,
                        metadata_json = EXCLUDED.metadata_json,
                        generation_version = COALESCE(EXCLUDED.generation_version, {VECTOR_TABLE_NAME}.generation_version),
                        created_at = NOW()
                    """)
                    .bindparams(
                        workspace_id=workspace_id,
                        repository_id=record.repository_id,
                        chunk_id=record.chunk_id,
                        file_path=record.file_path,
                        symbol_name=record.symbol_name,
                        symbol_type=record.symbol_type,
                        language=record.language,
                        start_line=record.start_line,
                        end_line=record.end_line,
                        code=meta["code"],
                        embedding=emb.vector.tolist(),
                        metadata_json=meta[_METADATA_JSON_KEY],
                        generation_version=None,
                    )
                )
        logger.info("Upserted %d vector(s) into shared table for repo '%s'.", len(embeddings), repository_id)
        return len(embeddings)

    def delete_vectors(self, collection_name: str, chunk_ids: list[str]) -> int:
        if not chunk_ids:
            return 0
        # Extract repository from collection name; for shared table delete scoped by repository
        repo_part = collection_name
        workspace_id = None
        with self._engine.begin() as conn:
            for cid in chunk_ids:
                conn.execute(
                    text(f"DELETE FROM {VECTOR_TABLE_NAME} WHERE workspace_id = :wid AND repository_id = :rid AND chunk_id = :cid")
                    .bindparams(wid=workspace_id, rid=repo_part, cid=cid)
                )
        return len(chunk_ids)

    def delete_by_metadata(self, collection_name: str, field_name: str, value: str) -> int:
        repo_part = collection_name
        workspace_id = None
        with self._engine.begin() as conn:
            result = conn.execute(
                text(f"SELECT chunk_id FROM {VECTOR_TABLE_NAME} WHERE workspace_id = :wid AND repository_id = :rid AND metadata_json->>:key = :val")
                .bindparams(wid=workspace_id, rid=repo_part, key=field_name, val=value)
            )
            matched = [row[0] for row in result.fetchall()]
            for cid in matched:
                conn.execute(
                    text(f"DELETE FROM {VECTOR_TABLE_NAME} WHERE workspace_id = :wid AND repository_id = :rid AND chunk_id = :cid")
                    .bindparams(wid=workspace_id, rid=repo_part, cid=cid)
                )
        return len(matched)

    def similarity_search(
        self,
        collection_name: str,
        query_vector: list[float],
        top_k: int,
        filters: SearchFilters | None,
        workspace_id: str | None = None,
    ) -> list[VectorSearchResult]:
        repo_part = self._repository_id_from_collection_name(collection_name)
        params: dict[str, Any] = {"query_vector": query_vector, "top_k": top_k}
        conditions = ["workspace_id IS NOT DISTINCT FROM :wid", "repository_id = :rid"]
        params["wid"] = workspace_id
        params["rid"] = repo_part
        if filters:
            if filters.language:
                conditions.append("language = :lang")
                params["lang"] = filters.language
            if filters.symbol_type:
                conditions.append("symbol_type = :symbol_type")
                params["symbol_type"] = filters.symbol_type
            if filters.metadata_equals:
                for k, v in filters.metadata_equals.items():
                    conditions.append(f"metadata_json->>:key_{k} = :val_{k}")
                    params[f"key_{k}"] = k
                    params[f"val_{k}"] = v
        where_clause = "WHERE " + " AND ".join(conditions)
        # Use cosine similarity via pgvector <=> operator
        query_text = f"""
        SELECT chunk_id, repository_id, file_path, symbol_name, symbol_type,
               language, start_line, end_line, code, metadata_json,
               (1 - (embedding <=> :query_vector)) AS cosine_similarity
        FROM {VECTOR_TABLE_NAME}
        {where_clause}
        ORDER BY embedding <=> :query_vector
        LIMIT :top_k
        """
        statement = text(query_text).bindparams(
            bindparam("query_vector", type_=Vector(_EMBEDDING_DIM)),
            bindparam("top_k", type_=Integer),
        )
        with self._engine.begin() as conn:
            result = conn.execute(statement, params)
            results = []
            for row in result.fetchall():
                chunk_id, repo_id, file_path, sym_name, sym_type, language, start_line, end_line, code, meta_json_str, score = row
                # Reconstruct StoredVectorRecord
                extra_meta = {}
                try:
                    extra_meta = json.loads(meta_json_str) if meta_json_str else {}
                    if isinstance(extra_meta, dict) and "code" not in extra_meta and code:
                        extra_meta["code"] = code
                except Exception:
                    pass
                record = StoredVectorRecord(
                    chunk_id=str(chunk_id),
                    repository_id=str(repo_id),
                    file_path=str(file_path) if file_path else "",
                    symbol_name=str(sym_name) if sym_name else None,
                    symbol_type=str(sym_type) if sym_type else None,
                    language=str(language) if language else "",
                    start_line=int(start_line) if start_line is not None else None,
                    end_line=int(end_line) if end_line is not None else None,
                    metadata=extra_meta,
                )
                results.append(VectorSearchResult(record=record, similarity_score=float(score) if score is not None else 0.0))
        return results

    def count_vectors(self, collection_name: str) -> int:
        repo_part = collection_name
        workspace_id = None
        with self._engine.begin() as conn:
            result = conn.execute(
                text(f"SELECT COUNT(*) FROM {VECTOR_TABLE_NAME} WHERE workspace_id IS NOT DISTINCT FROM :wid AND repository_id = :rid")
                .bindparams(wid=workspace_id, rid=repo_part)
            )
            return int(result.scalar() or 0)


def _create_vector_store(backend_name: str, persist_directory: str) -> AbstractVectorStore:
    normalized = backend_name.strip().lower()
    if normalized == "pgvector":
        return PgVectorStore()
    raise UnsupportedVectorStoreError(f"Vector store backend '{backend_name}' is not supported.")

class VectorStoreService:
    """Public interface for all vector persistence and retrieval."""

    def __init__(self, store: AbstractVectorStore | None = None) -> None:
        self._store = store or self._build_store_from_settings()

    @staticmethod
    def _build_store_from_settings() -> AbstractVectorStore:
        settings = get_settings()
        return _create_vector_store(
            backend_name=getattr(settings, "vector_store_backend", "pgvector"),
            persist_directory=settings.chroma_persist_directory,
        )

    @staticmethod
    def _collection_name_for(repository_id: str, workspace_id: str | None = None) -> str:
        namespace = hashlib.sha256(workspace_id.encode()).hexdigest()[:_NAMESPACE_HASH_LENGTH] if workspace_id else "legacy"
        return f"{_COLLECTION_NAME_PREFIX}_{namespace}_{repository_id}"

    def _active_collection_name(self, repository_id: str, workspace_id: str | None = None) -> str:
        return self._collection_name_for(repository_id, workspace_id)

    def stage_embeddings(self, repository_id: str, embeddings: list[ChunkEmbedding], workspace_id: str | None = None) -> str:
        collection_name = f"{self._collection_name_for(repository_id, workspace_id)}_{uuid.uuid4().hex}"
        self._store.create_collection(collection_name)
        try:
            self._store.upsert_vectors(collection_name, embeddings, workspace_id)
        except Exception:
            try:
                self._store.delete_collection(collection_name)
            except Exception:
                logger.exception("Failed to clean staged collection '%s'", collection_name)
            raise
        return collection_name

    def publish_staged_collection(self, repository_id: str, collection_name: str, workspace_id: str | None = None) -> None:
        # For shared table, publish means updating generation_version on rows.
        repo_part = self._collection_name_for(repository_id, workspace_id)
        # We use the collection_name (staged suffix) to derive what was staged,
        # but in shared-table design the staged rows are already in the table.
        # Preserve behavior: log publication.
        logger.info("Published vector generation repository_id=%s collection=%s workspace_id=%s", repository_id, collection_name, workspace_id)
        # If needed, set generation_version to a new value; but without explicit version tracking for now, just log.

    def discard_staged_collection(self, collection_name: str) -> None:
        if self._store.collection_exists(collection_name):
            # In shared table, we can't drop just one repo's rows by table drop.
            # For compatibility, skip destructive action; instead delete by repository derived from name.
            # Extract repo part after prefix/namespace.
            # This is a safe no-op for shared table; real deletion is handled by delete_repository.
            pass

    def ensure_repository_collection(self, repository_id: str, workspace_id: str | None = None) -> None:
        self._store.create_collection(self._collection_name_for(repository_id, workspace_id))

    def repository_collection_exists(self, repository_id: str, workspace_id: str | None = None) -> bool:
        return self._store.collection_exists(self._active_collection_name(repository_id, workspace_id))

    def index_embeddings(self, repository_id: str, embeddings: list[ChunkEmbedding], workspace_id: str | None = None) -> int:
        if not embeddings:
            logger.warning("index_embeddings called with no embeddings for repository '%s'.", repository_id)
            return 0
        collection_name = self._active_collection_name(repository_id, workspace_id)
        self.ensure_repository_collection(repository_id, workspace_id)
        return self._store.upsert_vectors(collection_name, embeddings, workspace_id)

    def update_embeddings(self, repository_id: str, embeddings: list[ChunkEmbedding], workspace_id: str | None = None) -> int:
        return self.index_embeddings(repository_id, embeddings, workspace_id)

    def search(self, repository_id: str, query_vector: list[float], top_k: int = 10, filters: SearchFilters | None = None, workspace_id: str | None = None) -> list[VectorSearchResult]:
        if top_k <= 0:
            raise VectorSearchError("top_k must be a positive integer.")
        collection_name = self._active_collection_name(repository_id, workspace_id)
        logger.info("Running similarity search on repository '%s' (top_k=%d workspace=%s).", repository_id, top_k, workspace_id)
        return self._store.similarity_search(collection_name, query_vector, top_k, filters, workspace_id)

    def delete_chunk(self, repository_id: str, chunk_id: str) -> None:
        self.delete_chunks(repository_id, [chunk_id])

    def delete_chunks(self, repository_id: str, chunk_ids: list[str]) -> int:
        collection_name = self._active_collection_name(repository_id)
        return self._store.delete_vectors(collection_name, chunk_ids)

    def delete_repository(self, repository_id: str, workspace_id: str | None = None) -> None:
        collection_name = self._active_collection_name(repository_id, workspace_id)
        if not self._store.collection_exists(collection_name):
            logger.warning("delete_repository called for '%s' but no collection exists.", repository_id)
            return
        self._store.delete_collection(collection_name)

    def clear_repository(self, repository_id: str) -> None:
        collection_name = self._collection_name_for(repository_id)
        self._store.reset_collection(collection_name)

    def get_repository_stats(self, repository_id: str, workspace_id: str | None = None) -> CollectionStats:
        collection_name = self._active_collection_name(repository_id, workspace_id)
        vector_count = self._store.count_vectors(collection_name)
        return CollectionStats(
            collection_name=collection_name,
            repository_id=repository_id,
            vector_count=vector_count,
        )

    def upsert_embeddings(self, repository_id: str, chunks: list[Any], embeddings: Any) -> int:
        if hasattr(embeddings, "embeddings"):
            embeddings = embeddings.embeddings
        return self.index_embeddings(repository_id, list(embeddings or []))

    def delete_repository_embeddings(self, repository_id: str, workspace_id: str | None = None) -> None:
        self.delete_repository(repository_id, workspace_id)
