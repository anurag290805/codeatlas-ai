from __future__ import annotations

import asyncio
from pathlib import Path
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import main
from app.core.config import Settings
from app.core.llm import OllamaProvider
from app.utils.logger import _create_file_handler


def test_backend_env_file_loads_csv_and_resolves_paths(tmp_path: Path) -> None:
    env_file = tmp_path / ".env"
    env_file.write_text(
        "CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:4173\n"
        "CHROMA_DB_PATH=./data/chroma\n",
        encoding="utf-8",
    )
    settings = Settings(_env_file=env_file)
    assert settings.cors_allowed_origins == [
        "http://localhost:5173",
        "http://localhost:4173",
    ]
    assert settings.chroma_persist_directory.is_absolute()


def test_shell_environment_overrides_env_file(tmp_path: Path, monkeypatch) -> None:
    env_file = tmp_path / ".env"
    env_file.write_text("OLLAMA_MODEL=from-file\n", encoding="utf-8")
    monkeypatch.setenv("OLLAMA_MODEL", "from-shell")
    assert Settings(_env_file=env_file).ollama_model == "from-shell"


def test_debug_accepts_deployment_labels(monkeypatch) -> None:
    monkeypatch.delenv("DEBUG", raising=False)
    assert Settings(_env_file=None, debug="release").debug is False
    assert Settings(_env_file=None, debug="production").debug is False
    assert Settings(_env_file=None, debug="debug").debug is True


def test_render_postgres_url_is_normalized() -> None:
    settings = Settings(
        _env_file=None,
        database_url="postgres://user:secret@example.internal:5432/codeatlas",
    )
    assert settings.DATABASE_URL == (
        "postgresql://user:secret@example.internal:5432/codeatlas"
    )


def test_sqlite_database_url_remains_local_development_default() -> None:
    settings = Settings(_env_file=None)
    assert settings.DATABASE_URL.startswith("sqlite:///")
    assert settings.DATABASE_URL.endswith("/data/app.db")


def test_configured_cors_origin_allows_request_and_preflight(monkeypatch) -> None:
    settings = SimpleNamespace(
        cors_allowed_origins=["http://localhost:4173"],
        cors_allow_credentials=True,
        trusted_hosts=[],
    )
    monkeypatch.setattr(main, "get_settings", lambda: settings)
    app = FastAPI()
    app.get("/probe")(lambda: {"ok": True})
    main._register_middleware(app)

    with TestClient(app) as client:
        response = client.get("/probe", headers={"Origin": "http://localhost:4173"})
        assert response.headers["access-control-allow-origin"] == "http://localhost:4173"
        preflight = client.options(
            "/probe",
            headers={
                "Origin": "http://localhost:4173",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert preflight.status_code == 200
        assert preflight.headers["access-control-allow-origin"] == "http://localhost:4173"

        rejected = client.get("/probe", headers={"Origin": "http://unconfigured.test"})
        assert "access-control-allow-origin" not in rejected.headers


class _HealthResponse:
    status_code = 200

    def json(self):
        return {"models": [{"name": "llama3.2:1b"}]}


class _HealthClient:
    async def get(self, _url: str, **_kwargs):
        return _HealthResponse()


def test_ollama_health_probe_reports_model_availability() -> None:
    settings = Settings(_env_file=None, ollama_model="llama3.2:1b")
    health = asyncio.run(OllamaProvider(settings=settings, client=_HealthClient()).check_health())
    assert health.reachable is True
    assert health.model_available is True


def test_logger_falls_back_when_log_file_cannot_be_created(tmp_path: Path) -> None:
    parent_file = tmp_path / "not-a-directory"
    parent_file.write_text("x", encoding="utf-8")
    assert _create_file_handler(parent_file / "app.log", 20) is None
