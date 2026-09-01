"""Small, bounded in-process indexing queue.

The database is the durable source of truth.  The queue only provides a
bounded executor for the current web process; pending jobs are recovered on
startup, so a Render restart does not lose an import.
"""

from __future__ import annotations

from dataclasses import dataclass
from queue import Full, Queue
from threading import Lock, Thread
from datetime import datetime, timedelta, timezone

from app.db.database import db_session
from app.utils.logger import get_logger

logger = get_logger(__name__)

_MAX_WORKERS = 2
_MAX_QUEUED_JOBS = 32


@dataclass(frozen=True)
class IndexingJob:
    repository_id: str
    clone_url: str
    is_update: bool
    workspace_id: str


_jobs: Queue[IndexingJob] = Queue(maxsize=_MAX_QUEUED_JOBS)
_started = False
_active_ids: set[str] = set()
_active_lock = Lock()


def _worker() -> None:
    while True:
        job = _jobs.get()
        try:
            # Imports are intentionally lazy: routes_repo imports this module.
            from app.api.routes_repo import _run_indexing_pipeline, get_embedding_service, get_git_repository_manager, get_repository_parser, get_vector_store_service

            with db_session() as db:
                _run_indexing_pipeline(
                    repository_id=job.repository_id,
                    clone_url=job.clone_url,
                    is_update=job.is_update,
                    db=db,
                    git_manager=get_git_repository_manager(),
                    parser=get_repository_parser(),
                    embedding_service=get_embedding_service(),
                    vector_store_service=get_vector_store_service(),
                    workspace_id=job.workspace_id,
                )
        except Exception:  # the pipeline records domain failures itself
            logger.exception("Indexing worker crashed repository_id=%s", job.repository_id)
            try:
                from app.db import crud
                from app.models import schemas
                with db_session() as failure_db:
                    crud.update_repository_status(
                        failure_db,
                        job.repository_id,
                        schemas.RepositoryStatus.FAILED_IMPORT,
                        workspace_id=job.workspace_id,
                        indexing_stage="worker_error",
                        error_message="Indexing worker stopped unexpectedly; retry this import.",
                    )
            except Exception:
                logger.exception("Could not persist worker failure repository_id=%s", job.repository_id)
        finally:
            with _active_lock:
                _active_ids.discard(job.repository_id)
            _jobs.task_done()


def start_workers() -> None:
    global _started
    if _started:
        return
    _started = True
    for index in range(_MAX_WORKERS):
        Thread(target=_worker, name=f"codeatlas-indexer-{index}", daemon=True).start()
    logger.info("Indexing workers started workers=%d queue_capacity=%d", _MAX_WORKERS, _MAX_QUEUED_JOBS)


def enqueue_indexing_job(repository_id: str | int, clone_url: str, *, is_update: bool, workspace_id: str) -> bool:
    start_workers()
    repository_key = str(repository_id)
    with _active_lock:
        if repository_key in _active_ids:
            return True
        _active_ids.add(repository_key)
    try:
        _jobs.put_nowait(IndexingJob(repository_key, clone_url, is_update, workspace_id))
        return True
    except Full:
        with _active_lock:
            _active_ids.discard(repository_key)
        logger.error("Indexing queue is full repository_id=%s", repository_id)
        return False


def queued_job_count() -> int:
    return _jobs.qsize()


def recover_indexing_jobs() -> int:
    """Requeue durable pending jobs and reset jobs interrupted by a restart."""
    from sqlalchemy import select
    from app.models.db_models import Repository

    recovered = 0
    now = datetime.now(timezone.utc)
    with db_session() as db:
        rows = db.execute(select(Repository).where(Repository.indexing_status.in_(["pending", "indexing"]))).scalars().all()
        for repository in rows:
            heartbeat = repository.indexing_heartbeat_at
            if repository.indexing_status == "indexing" and heartbeat and heartbeat.tzinfo is None:
                heartbeat = heartbeat.replace(tzinfo=timezone.utc)
            if repository.indexing_status == "indexing" and heartbeat and now - heartbeat < timedelta(minutes=20):
                continue
            if repository.indexing_status == "indexing":
                repository.indexing_status = "pending"
                repository.indexing_stage = "queued"
                repository.indexing_progress = min(repository.indexing_progress, 5)
            db.commit()
            if repository.workspace_id and enqueue_indexing_job(repository.id, repository.url, is_update=False, workspace_id=repository.workspace_id):
                recovered += 1
    logger.info("Recovered durable indexing jobs count=%d", recovered)
    return recovered
