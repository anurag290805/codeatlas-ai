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

from datetime import datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path
import uuid
from collections.abc import Callable

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from app.core.workspace import ensure_workspace
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.core.embeddings import EmbeddingGenerationError, EmbeddingService
from app.core.git_handler import GitRepositoryManager, RepositoryOperationError
from app.core.graph_builder import get_graph_service
from app.core.parser import RepositoryParseError, RepositoryParser
from app.core.vector_store import VectorStoreError, VectorStoreService
from app.db import crud
from app.db.database import get_db
from app.models.db_models import Repository
from app.models import schemas
from app.utils.logger import get_logger

logger = get_logger(__name__)
_STALE_INDEXING_AFTER = timedelta(hours=2)

_STAGE_BOUNDS: dict[str, tuple[int, int]] = {
    "queued": (0, 0), "cloning": (0, 10), "discovering": (10, 20),
    "chunking": (20, 35), "embedding": (35, 75), "storing": (75, 95),
    "completed": (100, 100), "failed": (0, 100),
}


def _progress_updater(db: Session, repository_id: str) -> Callable[[str, int, int], None]:
    """Create a persistence-backed progress callback for pipeline stages."""
    def update(stage: str, processed: int, total: int) -> None:
        start, end = _STAGE_BOUNDS.get(stage, (0, 0))
        ratio = min(1.0, max(0.0, processed / total)) if total > 0 else 0.0
        progress = max(start, min(end, round(start + ratio * (end - start))))
        current = crud.get_repository(db, repository_id)
        if current is not None:
            progress = max(int(current.progress_percent or 0), progress)
        eta = None
        if current is not None and progress > 0 and current.last_index_attempt_at:
            started = current.last_index_attempt_at
            if started.tzinfo is None:
                started = started.replace(tzinfo=timezone.utc)
            elapsed = max(0, (datetime.now(timezone.utc) - started).total_seconds())
            eta = max(0, round(elapsed * (100 - progress) / progress))
        crud.update_repository_status(
            db, repository_id, schemas.RepositoryStatus.INDEXING,
            stage=stage, progress_percent=progress,
            processed_files=processed if stage in {"discovering", "chunking"} else None,
            total_files=total if stage in {"discovering", "chunking"} else None,
            processed_chunks=processed if stage == "embedding" else None,
            total_chunks=total if stage == "embedding" else None,
            processed_embeddings=processed if stage == "storing" else None,
            total_embeddings=total if stage == "storing" else None,
            estimated_seconds_remaining=eta,
        )
    return update


def _set_stage(db: Session, repository_id: str, stage: str, status: str | None = None) -> None:
    start, _ = _STAGE_BOUNDS[stage]
    current = crud.get_repository(db, repository_id)
    progress = max(start, int(current.progress_percent or 0)) if current else start
    crud.update_repository_status(
        db, repository_id, status or schemas.RepositoryStatus.INDEXING,
        stage=stage, progress_percent=progress,
    )

router = APIRouter(prefix="/repositories", tags=["repositories"], dependencies=[Depends(ensure_workspace)])


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

    This function records failures because it is executed as a background
    task, but preserves the original exception in logs and removes partial
    index state so a failed repository remains safely retryable.
    """
    staged_collection: str | None = None
    staged_clone: Path | None = None
    try:
        repository_numeric_id = int(repository_id)
        _set_stage(db, repository_id, "queued")
        identity = git_manager.validate_repository_url(clone_url)
        _set_stage(db, repository_id, "cloning")
        if is_update:
            logger.info("Indexing stage started repository_id=%s stage=update", repository_id)
            metadata = git_manager.update_repository(clone_url)
            local_path = Path(metadata.local_path)
        else:
            live_path = git_manager.resolve_local_path(identity)
            staged_clone = live_path.parent / f".{live_path.name}.indexing-{uuid.uuid4().hex}"
            logger.info("Indexing stage started repository_id=%s stage=clone", repository_id)
            metadata = git_manager.clone_repository(clone_url, target_path=staged_clone)
            local_path = Path(metadata.local_path)
        logger.info("Indexing stage finished repository_id=%s stage=clone", repository_id)

        progress = _progress_updater(db, repository_id)
        _set_stage(db, repository_id, "discovering")
        logger.info("Indexing stage started repository_id=%s stage=discovering_files", repository_id)
        parse_result = parser.parse_repository(repository_numeric_id, local_path, progress_callback=progress)
        progress("chunking", len(parse_result.files), len(parse_result.files))

        logger.info("Indexing stage started repository_id=%s stage=graph", repository_id)
        graph_service = get_graph_service()
        graph = graph_service.build_staged_graph(parse_result)

        _set_stage(db, repository_id, "embedding")
        logger.info("Indexing stage started repository_id=%s stage=embedding", repository_id)
        chunks = parse_result.chunks
        embeddings = embedding_service.generate_embeddings(
            chunks, repository_id=repository_id,
            progress_callback=lambda done, total: progress("embedding", done, total),
        )
        embedding_items = list(getattr(embeddings, "embeddings", embeddings) or [])
        logger.info(
            "Embedding generation completed repository_id=%s chunks=%d embeddings=%d",
            repository_id,
            len(chunks),
            len(embedding_items),
        )

        _set_stage(db, repository_id, "storing")
        logger.info("Indexing stage started repository_id=%s stage=storing", repository_id)
        staged_collection = vector_store_service.stage_embeddings(
            repository_id, list(getattr(embeddings, "embeddings", embeddings) or []),
            progress_callback=lambda done, total: progress("storing", done, total),
        )

        logger.info("Indexing stage started repository_id=%s stage=commit", repository_id)
        vector_store_service.publish_staged_collection(repository_id, staged_collection)
        graph_service.publish_graph(graph)
        promoted_path = (
            local_path
            if is_update
            else git_manager.promote_repository_clone(identity, local_path)
        )
        crud.update_repository(
            db, repository_numeric_id, local_path=str(promoted_path),
            default_branch=metadata.default_branch or "main",
            current_commit_hash=metadata.current_commit_hash or None,
        )
        crud.replace_indexed_files(db, repository_id=repository_id, parsed_files=parse_result.files)
        crud.update_repository_status(
            db, repository_id=repository_id, status=schemas.RepositoryStatus.READY,
            stage="completed", progress_percent=100,
            total_files=len(parse_result.files), total_chunks=len(chunks),
            total_embeddings=len(embedding_items), processed_files=len(parse_result.files),
            processed_chunks=len(chunks), processed_embeddings=len(embedding_items),
        )
        graph_stats = graph.statistics()
        logger.info(
            "Repository indexing committed repository_id=%s files=%d chunks=%d embeddings=%d nodes=%d edges=%d",
            repository_id, len(parse_result.files), len(chunks), len(embedding_items),
            graph_stats.total_nodes,
            graph_stats.total_edges,
        )

    except RepositoryOperationError as exc:
        _mark_indexing_failed(db, repository_id, "git", exc, vector_store_service, staged_collection, staged_clone)
    except RepositoryParseError as exc:
        _mark_indexing_failed(db, repository_id, "parser", exc, vector_store_service, staged_collection, staged_clone)
    except EmbeddingGenerationError as exc:
        _mark_indexing_failed(db, repository_id, "embedding", exc, vector_store_service, staged_collection, staged_clone)
    except VectorStoreError as exc:
        _mark_indexing_failed(db, repository_id, "vector_store", exc, vector_store_service, staged_collection, staged_clone)
    except Exception as exc:  # noqa: BLE001 - final safety net for a background task
        _mark_indexing_failed(db, repository_id, "unknown", exc, vector_store_service, staged_collection, staged_clone)


def _mark_indexing_failed(
    db: Session,
    repository_id: str,
    stage: str,
    exc: Exception,
    vector_store_service: VectorStoreService | None = None,
    staged_collection: str | None = None,
    staged_clone: Path | None = None,
) -> None:
    """Record failure and remove only artifacts from this indexing attempt."""
    logger.exception("Indexing failed repository_id=%s stage=%s error=%s", repository_id, stage, exc)
    if vector_store_service is not None and staged_collection:
        try:
            vector_store_service.discard_staged_collection(staged_collection)
        except Exception as cleanup_exc:  # noqa: BLE001
            logger.exception(
                "Indexing rollback failed repository_id=%s stage=vector_store_cleanup error=%s",
                repository_id,
                cleanup_exc,
            )
    if staged_clone is not None:
        try:
            import shutil
            shutil.rmtree(staged_clone, ignore_errors=True)
        except Exception:
            logger.exception("Indexing rollback failed repository_id=%s stage=clone_cleanup", repository_id)
    previous = crud.get_repository(db, repository_id)
    had_usable_index = bool(previous and (previous.total_embeddings or previous.total_chunks or previous.total_files))
    failure_status = schemas.RepositoryStatus.INDEX_FAILED if had_usable_index else schemas.RepositoryStatus.FAILED_IMPORT
    crud.update_repository_status(
        db,
        repository_id=repository_id,
        status=failure_status,
        stage="failed", progress_percent=getattr(previous, "progress_percent", 0) if previous else 0,
        error_message="Indexing failed. Retry the repository to try again.",
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
    identity = git_manager.validate_repository_url(str(payload.url))
    canonical_url = identity.canonical_url
    existing = crud.get_repository_by_url(db, repository_url=canonical_url)
    if existing is None and str(payload.url) != canonical_url:
        # Accept legacy rows created before URL canonicalization was added.
        existing = crud.get_repository_by_url(db, repository_url=str(payload.url))
    if existing is not None:
        retryable_statuses = {
            schemas.RepositoryStatus.FAILED.value,
            schemas.RepositoryStatus.INDEX_FAILED.value,
            schemas.RepositoryStatus.FAILED_IMPORT.value,
        }
        if existing.status not in retryable_statuses:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Repository already registered: {canonical_url}",
            )
        repository = crud.update_repository_status(
            db,
            repository_id=existing.id,
            status=schemas.RepositoryStatus.PENDING,
            stage="queued", progress_percent=0, processed_files=0,
            processed_chunks=0, processed_embeddings=0,
            total_files=existing.files_indexed,
            total_chunks=existing.chunks_generated,
            total_embeddings=existing.embeddings_generated,
        )
        if repository is None:
            raise HTTPException(status_code=404, detail=f"Repository not found: {existing.id}")
        logger.info("Retrying failed repository import repository_id=%s url=%s", repository.id, canonical_url)
    else:
        try:
            repository = crud.create_repository(
                db,
                repository_name=identity.full_name,
                repository_url=canonical_url,
                default_branch=payload.branch or "main",
            )
        except IntegrityError as exc:
            logger.warning("Repository import conflict workspace-scoped url=%s", canonical_url)
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Repository is already registered in this workspace.",
            ) from exc

    logger.info("Repository import scheduled repository_id=%s url=%s", repository.id, canonical_url)

    background_tasks.add_task(
        _run_indexing_pipeline,
        repository_id=repository.id,
        clone_url=canonical_url,
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
    workspace_id: str = Depends(ensure_workspace),
    db: Session = Depends(get_db),
) -> schemas.RepositoryListResponse:
    """Return a paginated collection of registered repositories."""
    repositories = [_recover_stale_indexing(db, repository) for repository in crud.list_repositories(db, skip=skip, limit=limit, workspace_id=workspace_id)]
    total = crud.count_repositories(db, workspace_id=workspace_id)
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
    repository = _recover_stale_indexing(db, _get_repository_or_404(db, repository_id))
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
    repository = _recover_stale_indexing(db, _get_repository_or_404(db, repository_id))
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
        db, repository_id=repository_id, status=schemas.RepositoryStatus.INDEXING,
        stage="queued", progress_percent=0, processed_files=0,
        processed_chunks=0, processed_embeddings=0, estimated_seconds_remaining=None,
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
        db, repository_id=repository_id, status=schemas.RepositoryStatus.INDEXING,
        stage="queued", progress_percent=0, processed_files=0,
        processed_chunks=0, processed_embeddings=0, estimated_seconds_remaining=None,
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
    repository_numeric_id = int(repository.id)
    crud.update_repository_status(db, repository_id=repository_numeric_id, status=schemas.RepositoryStatus.DELETING)

    try:
        identity = git_manager.validate_repository_url(repository.url)
        git_manager.delete_repository(identity)
    except RepositoryOperationError as exc:
        logger.exception("Local clone cleanup failed repository_id=%s", repository_id)
        raise HTTPException(status_code=502, detail="Failed to remove repository clone. Please retry.") from exc

    try:
        vector_store_service.delete_repository_embeddings(repository_id)
    except VectorStoreError as exc:
        logger.exception("Vector store deletion failed repository_id=%s", repository_id)
        raise HTTPException(status_code=502, detail="Failed to remove repository vectors. Please retry.") from exc

    get_graph_service().delete_persisted_graph(repository_id)

    crud.delete_repository(db, repository_id=repository_numeric_id)
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
        indexed=crud.count_repositories_by_status(db, status=schemas.RepositoryStatus.READY.value),
        failed=crud.count_repositories_by_status(db, status=schemas.RepositoryStatus.INDEX_FAILED.value),
        pending=crud.count_repositories_by_status(db, status=schemas.RepositoryStatus.INDEXING.value),
    )

@router.get(
    "/{repository_id}/files",
    response_model=schemas.RepositoryFilesResponse,
    summary="List repository files",
)
def list_repository_files(
    repository_id: int,
    db: Session = Depends(get_db),
) -> schemas.RepositoryFilesResponse:
    """
    Return all indexed files belonging to a repository.
    """
    repository = crud.get_repository(db, repository_id=repository_id)

    if repository is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository not found: {repository_id}",
        )

    files = crud.list_repository_files(db, repository_id)

    return schemas.RepositoryFilesResponse(
        files=[
            schemas.RepositoryFileResponse(
                id=file.id,
                relative_path=file.relative_path,
                language=_language_value(file.programming_language),
                file_size_bytes=file.file_size,
                checksum_sha256=file.checksum,
                chunks_generated=file.chunk_count,
            )
            for file in files
        ]
    )


@router.get(
    "/{repository_id}/files/content",
    response_model=schemas.RepositoryFileContentResponse,
    summary="Get file content",
    description="Returns the content of a specific file in the repository.",
)
def get_repository_file_content(
    repository_id: int,
    path: str = Query(..., description="Relative path to the file within the repository."),
    db: Session = Depends(get_db),
    git_manager: GitRepositoryManager = Depends(get_git_repository_manager),
) -> schemas.RepositoryFileContentResponse:
    """
    Return the content of a specific file from a cloned repository.
    """
    repository = crud.get_repository(db, repository_id=repository_id)
    if repository is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository not found: {repository_id}",
        )

    if not repository.local_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository has not been cloned yet.",
        )

    from pathlib import Path
    local_path = Path(repository.local_path)
    file_path = local_path / path

    # Security: ensure the path doesn't escape the repository root
    try:
        file_path = file_path.resolve()
        if not str(file_path).startswith(str(local_path.resolve())):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: path outside repository root.",
            )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file path: {path}",
        ) from exc

    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File not found: {path}",
        )

    if not file_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Path is not a file: {path}",
        )

    # Check if file is binary
    try:
        with open(file_path, "rb") as f:
            content_bytes = f.read()
            # Try to decode as UTF-8, if it fails it's likely binary
            try:
                content = content_bytes.decode("utf-8")
            except UnicodeDecodeError:
                raise HTTPException(
                    status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                    detail=f"Cannot preview binary file: {path}",
                )
    except OSError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read file: {exc}",
        ) from exc

    # Detect language from extension
    extension_to_language: dict[str, str] = {
        ".py": "python",
        ".ts": "typescript",
        ".tsx": "typescript",
        ".js": "javascript",
        ".jsx": "javascript",
        ".java": "java",
        ".go": "go",
        ".rs": "rust",
        ".rb": "ruby",
        ".php": "php",
        ".c": "c",
        ".cpp": "cpp",
        ".h": "c",
        ".hpp": "cpp",
        ".cs": "csharp",
        ".swift": "swift",
        ".kt": "kotlin",
        ".scala": "scala",
        ".r": "r",
        ".sql": "sql",
        ".sh": "bash",
        ".yaml": "yaml",
        ".yml": "yaml",
        ".json": "json",
        ".xml": "xml",
        ".html": "html",
        ".css": "css",
        ".scss": "scss",
        ".less": "less",
        ".md": "markdown",
        ".vue": "vue",
        ".svelte": "svelte",
    }
    extension = file_path.suffix.lower()
    language = extension_to_language.get(extension, "plaintext")

    return schemas.RepositoryFileContentResponse(
        path=path,
        content=content,
        language=language,
        size_bytes=len(content_bytes),
    )

# =========================================================================
# Helpers
# =========================================================================


def _language_value(language: object) -> str:
    """Normalize enum instances and legacy enum-repr database values."""
    value = getattr(language, "value", language)
    text = str(value)
    return text.rsplit(".", 1)[-1].lower()


def _get_repository_or_404(db: Session, repository_id: str) -> Repository:
    """Fetch a repository by identifier or raise a 404 HTTPException."""
    repository = crud.get_repository(db, repository_id=repository_id)
    if repository is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository not found: {repository_id}",
        )
    return repository


def _recover_stale_indexing(db: Session, repository: Repository) -> Repository:
    """Make abandoned in-process jobs retryable when they are observed."""
    active_statuses = {
        schemas.RepositoryStatus.PENDING.value,
        schemas.RepositoryStatus.INDEXING.value,
        schemas.RepositoryStatus.CLONING.value,
        schemas.RepositoryStatus.DISCOVERING_FILES.value,
        schemas.RepositoryStatus.CHUNKING.value,
        schemas.RepositoryStatus.EMBEDDING.value,
        schemas.RepositoryStatus.STORING.value,
    }
    started_at = getattr(repository, "last_index_attempt_at", None)
    if repository.status not in active_statuses or started_at is None:
        return repository
    if started_at.tzinfo is None:
        started_at = started_at.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) - started_at <= _STALE_INDEXING_AFTER:
        return repository
    recovered = crud.update_repository_status(
        db,
        repository_id=repository.id,
        status=schemas.RepositoryStatus.FAILED_IMPORT,
        error_message="Indexing stopped before completion. Retry indexing to start a new job.",
    )
    return recovered or repository
