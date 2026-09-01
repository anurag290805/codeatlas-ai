"""Security regression tests for workspace ownership boundaries."""

from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.vector_store import VectorStoreService
from app.db import crud
from app.models.db_models import Repository
from app.db.database import Base


def _session() -> Session:
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    return Session(engine)


def test_repository_listing_and_lookup_are_workspace_scoped() -> None:
    db = _session()
    first = crud.create_repository(db, repository_name="a/one", repository_url="https://github.com/a/one", workspace_id="workspace-a")
    second = crud.create_repository(db, repository_name="b/two", repository_url="https://github.com/b/two", workspace_id="workspace-b")

    assert [repo.id for repo in crud.list_repositories(db, workspace_id="workspace-a")] == [first.id]
    assert crud.get_repository(db, second.id, workspace_id="workspace-a") is None
    assert crud.count_repositories(db, workspace_id="workspace-a") == 1


def test_same_github_repository_can_be_owned_by_two_workspaces() -> None:
    db = _session()
    url = "https://github.com/shared/repository"
    first = crud.create_repository(db, repository_name="shared/repository", repository_url=url, workspace_id="workspace-a")
    second = crud.create_repository(db, repository_name="shared/repository", repository_url=url, workspace_id="workspace-b")
    assert first.id != second.id


def test_legacy_unassigned_rows_are_not_visible_to_any_workspace() -> None:
    db = _session()
    legacy = Repository(repository_name="legacy/repository", repository_url="https://github.com/legacy/repository", local_path="")
    db.add(legacy)
    db.commit()
    assert crud.list_repositories(db, workspace_id="new-workspace") == []
    assert crud.get_repository(db, legacy.id, workspace_id="new-workspace") is None


def test_vector_collection_names_are_workspace_isolated() -> None:
    first = VectorStoreService._collection_name_for("7", "workspace-a")
    second = VectorStoreService._collection_name_for("7", "workspace-b")
    assert first != second
    assert "workspace-a" not in first
    assert "workspace-b" not in second
