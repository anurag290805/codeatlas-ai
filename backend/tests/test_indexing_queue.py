"""Regression coverage for queue safety independent of GitHub/Chroma."""

from app.core import indexing_queue


def test_indexing_job_has_workspace_scoped_identity() -> None:
    job = indexing_queue.IndexingJob("12", "https://github.com/a/b", False, "workspace-a")
    assert job.repository_id == "12"
    assert job.workspace_id == "workspace-a"


def test_duplicate_repository_jobs_are_deduplicated(monkeypatch) -> None:
    class ImmediateQueue:
        def put_nowait(self, job):
            self.job = job

        def qsize(self):
            return 1

    queue = ImmediateQueue()
    monkeypatch.setattr(indexing_queue, "_jobs", queue)
    monkeypatch.setattr(indexing_queue, "_started", True)
    monkeypatch.setattr(indexing_queue, "_active_ids", set())

    assert indexing_queue.enqueue_indexing_job(12, "https://github.com/a/b", is_update=False, workspace_id="a")
    assert indexing_queue.enqueue_indexing_job(12, "https://github.com/a/b", is_update=False, workspace_id="a")
    assert queue.job.repository_id == "12"
