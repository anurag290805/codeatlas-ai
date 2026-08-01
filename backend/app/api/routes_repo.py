"""
REST API routes for repository lifecycle management in CodeAtlas AI.

This router exposes endpoints for importing, listing, inspecting,
updating, re-indexing, and deleting repositories. It orchestrates the
existing backend services -- GitRepositoryManager, RepositoryParser,
EmbeddingService, VectorStoreService, and the CRUD layer -- without
containing any business logic of its own.

Long-running indexing work (clone, parse, embed, upsert) runs via
FastAPI BackgroundTasks so request handlers remain non-blocking. The
orchestration function is isolated so it can later be moved to a
dedicated task queue (e.g. Celery, arq) without changing the API
contract exposed to clients.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.embeddings import EmbeddingGenerationError, EmbeddingService
from app.core.git_handler import GitRepositoryManager, RepositoryOperationError
from app.core.parser import RepositoryParseError, RepositoryParser
from app.core.vector_store import VectorStoreError, VectorStoreService
from app.db import crud
from app.db.database import get_db
from app.models import schemas
from app.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/repositories", tags=["repositories"])


# =========================================================================
# Service dependency providers
#
# Services are constructed once per process and reused across requests.
# Each provider is a plain FastAPI dependency, keeping the door open for
# future overrides (e.g. authenticated/tenant-scoped service instances)
# without changing endpoint signatures.
# =========================================================================


@lru_cache
def get_git_repository_manager() -> GitRepositoryManager:
    """Provide a shared GitRepositoryManager instance."""
    return GitRepositoryManager()


@lru_cache
def get_repository_parser() -> RepositoryParser:
    """Provide a shared RepositoryParser instance."""
    return RepositoryParser()


@lru_cache
def get_embedding_service() -> EmbeddingService:
    """Provide a shared EmbeddingService instance."""
    return EmbeddingService()


@lru_cache
def get_vector_store_service() -> VectorStoreService:
    """Provide a shared VectorStoreService instance."""
    return VectorStoreService()


# =========================================================================
# Indexing orchestration
#
# This function coordinates the full indexing pipeline. It is invoked
# from request handlers via BackgroundTasks and never called directly
# from a synchronous request path, so client requests return immediately
# with a PENDING status while indexing proceeds asynchronously.
# =========================================================================


def _run_indexing_pipeline(
    repository_id: str,
    clone_url: str,
    *,
    is_update: bool,
    db: Session,
    git_manager: GitRepositoryManager,
    parser: RepositoryParser,
    embedding_service: EmbeddingService,
    vector_store_service: VectorStoreService,
) -> None:
    """
    Execute the full repository indexing pipeline: clone/update, parse,
    embed, store vectors, and persist metadata. Repository status is
    updated at each stage so clients can poll progress.

    This function swallows all pipeline exceptions after recording a
    FAILED status with a descriptive message -- it is executed as a
    background task and has no HTTP response to return errors through.
    """
    try:
        crud.update_repository_status(
            db, repository_id=repository_id, status=schemas.RepositoryStatus.CLONING
        )
        if is_update:
            metadata = git_manager.update_repository(clone_url)
        else:
            metadata = git_manager.clone_repository(clone_url)
        local_path = metadata.local_path

        crud.update_repository_status(
            db, repository_id=repository_id, status=schemas.RepositoryStatus.PARSING
        )
        parse_result = parser.parse_repository(int(repository_id), local_path)

        crud.update_repository_status(
            db, repository_id=repository_id, status=schemas.RepositoryStatus.EMBEDDING
        )
        chunks = parse_result.chunks
        embeddings = embedding_service.generate_embeddings(chunks)

        vector_store_service.upsert_embeddings(
            repository_id=repository_id, chunks=chunks, embeddings=embeddings
        )

        crud.replace_indexed_files(
            db, repository_id=repository_id, parsed_files=parse_result.files
        )
        crud.update_repository_status(
            db,
            repository_id=repository_id,
            status=schemas.RepositoryStatus.INDEXED,
            indexed_file_count=len(parse_result.files),
            indexed_chunk_count=len(chunks),
        )

        logger.info("Indexing completed repository_id=%s chunks=%d", repository_id, len(chunks))

    except RepositoryOperationError as exc:
        _mark_indexing_failed(db, repository_id, "git", exc)
    except RepositoryParseError as exc:
        _mark_indexing_failed(db, repository_id, "parser", exc)
    except EmbeddingGenerationError as exc:
        _mark_indexing_failed(db, repository_id, "embedding", exc)
    except VectorStoreError as exc:
        _mark_indexing_failed(db, repository_id, "vector_store", exc)
    except Exception as exc:  # noqa: BLE001 - final safety net for a background task
        _mark_indexing_failed(db, repository_id, "unknown", exc)


def _mark_indexing_failed(db: Session, repository_id: str, stage: str, exc: Exception) -> None:
    """Persist a FAILED status for a repository and log the originating stage."""
    logger.error("Indexing failed repository_id=%s stage=%s error=%s", repository_id, stage, exc)
    crud.update_repository_status(
        db,
        repository_id=repository_id,
        status=schemas.RepositoryStatus.FAILED,
        error_message=f"Indexing failed at stage '{stage}': {exc}",
    )


# =========================================================================
# Endpoints
# =========================================================================


@router.post(
    "",
    response_model=schemas.RepositoryResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Import a new repository",
    description=(
        "Registers a public GitHub repository and schedules indexing "
        "(clone, parse, embed, and store) as a background task. The "
        "repository is returned immediately with a PENDING status."
    ),
)
def import_repository(
    payload: schemas.RepositoryCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    git_manager: GitRepositoryManager = Depends(get_git_repository_manager),
    parser: RepositoryParser = Depends(get_repository_parser),
    embedding_service: EmbeddingService = Depends(get_embedding_service),
    vector_store_service: VectorStoreService = Depends(get_vector_store_service),
) -> schemas.RepositoryResponse:
    """Register a repository for indexing and schedule the indexing pipeline."""
    existing = crud.get_repository_by_url(db, repository_url=str(payload.url))
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Repository already registered: {payload.url}",
        )

    repository = crud.create_repository(db, obj_in=payload)
    logger.info("Repository imported repository_id=%s url=%s", repository.id, payload.url)

    background_tasks.add_task(
        _run_indexing_pipeline,
        repository_id=repository.id,
        clone_url=str(payload.url),
        is_update=False,
        db=db,
        git_manager=git_manager,
        parser=parser,
        embedding_service=embedding_service,
        vector_store_service=vector_store_service,
    )

    return schemas.RepositoryResponse.model_validate(repository)


@router.get(
    "",
    response_model=schemas.RepositoryListResponse,
    summary="List repositories",
    description="Returns a paginated list of all registered repositories.",
)
def list_repositories(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> schemas.RepositoryListResponse:
    """Return a paginated collection of registered repositories."""
    repositories = crud.list_repositories(db, skip=skip, limit=limit)
    total = crud.count_repositories(db)
    return schemas.RepositoryListResponse(
        items=[schemas.RepositoryResponse.model_validate(repo) for repo in repositories],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/{repository_id}",
    response_model=schemas.RepositoryResponse,
    summary="Get repository details",
    description="Returns full details for a single registered repository.",
)
def get_repository(
    repository_id: str,
    db: Session = Depends(get_db),
) -> schemas.RepositoryResponse:
    """Retrieve a single repository by identifier."""
    repository = _get_repository_or_404(db, repository_id)
    return schemas.RepositoryResponse.model_validate(repository)


@router.get(
    "/{repository_id}/status",
    response_model=schemas.RepositoryStatusResponse,
    summary="Get repository indexing status",
    description="Returns the current indexing status and progress metadata for a repository.",
)
def get_repository_status(
    repository_id: str,
    db: Session = Depends(get_db),
) -> schemas.RepositoryStatusResponse:
    """Retrieve the current indexing status for a repository."""
    repository = _get_repository_or_404(db, repository_id)
    return schemas.RepositoryStatusResponse.model_validate(repository)


@router.post(
    "/{repository_id}/reindex",
    response_model=schemas.RepositoryResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Re-index a repository",
    description=(
        "Re-runs the full indexing pipeline against the repository's "
        "current cloned state without pulling new commits."
    ),
)
def reindex_repository(
    repository_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    git_manager: GitRepositoryManager = Depends(get_git_repository_manager),
    parser: RepositoryParser = Depends(get_repository_parser),
    embedding_service: EmbeddingService = Depends(get_embedding_service),
    vector_store_service: VectorStoreService = Depends(get_vector_store_service),
) -> schemas.RepositoryResponse:
    """Schedule a full re-index of an already registered repository."""
    repository = _get_repository_or_404(db, repository_id)
    crud.update_repository_status(
        db, repository_id=repository_id, status=schemas.RepositoryStatus.PENDING
    )
    logger.info("Repository reindex requested repository_id=%s", repository_id)

    background_tasks.add_task(
        _run_indexing_pipeline,
        repository_id=repository_id,
        clone_url=repository.url,
        is_update=False,
        db=db,
        git_manager=git_manager,
        parser=parser,
        embedding_service=embedding_service,
        vector_store_service=vector_store_service,
    )

    return schemas.RepositoryResponse.model_validate(repository)


@router.post(
    "/{repository_id}/update",
    response_model=schemas.RepositoryResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Pull latest changes and re-index",
    description=(
        "Pulls the latest commits for the repository and re-runs the "
        "full indexing pipeline against the updated source."
    ),
)
def update_repository(
    repository_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    git_manager: GitRepositoryManager = Depends(get_git_repository_manager),
    parser: RepositoryParser = Depends(get_repository_parser),
    embedding_service: EmbeddingService = Depends(get_embedding_service),
    vector_store_service: VectorStoreService = Depends(get_vector_store_service),
) -> schemas.RepositoryResponse:
    """Schedule a git pull followed by a full re-index of the repository."""
    repository = _get_repository_or_404(db, repository_id)
    crud.update_repository_status(
        db, repository_id=repository_id, status=schemas.RepositoryStatus.PENDING
    )
    logger.info("Repository update requested repository_id=%s", repository_id)

    background_tasks.add_task(
        _run_indexing_pipeline,
        repository_id=repository_id,
        clone_url=repository.url,
        is_update=True,
        db=db,
        git_manager=git_manager,
        parser=parser,
        embedding_service=embedding_service,
        vector_store_service=vector_store_service,
    )

    return schemas.RepositoryResponse.model_validate(repository)


@router.delete(
    "/{repository_id}",
    response_model=None,
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a repository",
    description=(
        "Removes a repository's metadata, indexed vectors, and local "
        "clone. This operation cannot be undone."
    ),
)
def delete_repository(
    repository_id: str,
    db: Session = Depends(get_db),
    git_manager: GitRepositoryManager = Depends(get_git_repository_manager),
    vector_store_service: VectorStoreService = Depends(get_vector_store_service),
) -> None:
    """Delete a repository and all associated indexed data."""
    repository = _get_repository_or_404(db, repository_id)

    try:
        vector_store_service.delete_repository_embeddings(repository_id)
    except VectorStoreError as exc:
        logger.error("Vector store deletion failed repository_id=%s error=%s", repository_id, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to remove repository vectors. Please retry.",
        ) from exc

    try:
        git_manager.remove_local_clone(repository.url)
    except RepositoryOperationError as exc:
        logger.warning(
            "Local clone cleanup failed repository_id=%s error=%s", repository_id, exc
        )

    crud.delete_repository(db, repository_id=repository_id)
    logger.info("Repository deleted repository_id=%s", repository_id)


@router.get(
    "/health/check",
    response_model=schemas.RepositoryHealthResponse,
    summary="Repository subsystem health check",
    description="Returns aggregate counts of repositories by indexing status.",
)
def repository_health_check(
    db: Session = Depends(get_db),
) -> schemas.RepositoryHealthResponse:
    """Return aggregate repository counts grouped by indexing status."""
    return schemas.RepositoryHealthResponse(
        total_repositories=crud.count_repositories(db),
        indexed=crud.count_repositories_by_status(db, status=schemas.RepositoryStatus.INDEXED),
        failed=crud.count_repositories_by_status(db, status=schemas.RepositoryStatus.FAILED),
        pending=crud.count_repositories_by_status(db, status=schemas.RepositoryStatus.PENDING),
    )


# =========================================================================
# Helpers
# =========================================================================


def _get_repository_or_404(db: Session, repository_id: str) -> schemas.RepositoryResponse:
    """Fetch a repository by identifier or raise a 404 HTTPException."""
    repository = crud.get_repository(db, repository_id=repository_id)
    if repository is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository not found: {repository_id}",
        )
    return repository
