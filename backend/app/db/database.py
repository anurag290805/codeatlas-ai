"""Database configuration and lifecycle management for CodeAtlas AI.

This module owns the SQLAlchemy engine, session factory, and declarative
base used across the entire persistence layer. It is intentionally free
of business logic, ORM model definitions, and CRUD operations: its sole
responsibility is wiring up the database infrastructure so that other
modules — most notably `app/models/db_models.py` and FastAPI route
handlers — can depend on a consistently configured `Base`, `engine`, and
`SessionLocal`.

SQLite remains the default for local development. When `DATABASE_URL` is
set to a PostgreSQL URL (as it should be on Render), SQLAlchemy uses the
managed PostgreSQL database instead of the ephemeral application disk.
"""

from collections.abc import Generator
from contextlib import contextmanager

from sqlalchemy import Engine, create_engine, text, inspect
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from fastapi import Request

from app.config import get_settings
from app.utils.logger import get_logger

logger = get_logger(__name__)

# SQLite-specific connection arguments. Never pass these to PostgreSQL.
_SQLITE_CONNECT_ARGS = {"check_same_thread": False}


def _create_database_engine() -> Engine:
    """Build and return the SQLAlchemy engine for the application.

    Reads the database connection string from the application settings
    and configures engine options appropriate for the selected backend. The
    engine is created once at module load time and reused for the lifetime
    of the process.

    Returns:
        A configured SQLAlchemy `Engine` instance.

    Raises:
        ValueError: If the configured database URL is missing or empty.
    """
    settings = get_settings()
    database_url = settings.DATABASE_URL

    if not database_url:
        logger.error("DATABASE_URL is not configured; cannot create engine.")
        raise ValueError("DATABASE_URL must be set in the application configuration.")

    is_sqlite = database_url.startswith("sqlite")
    engine_options: dict[str, object] = {
        "future": True,
        # Render/PostgreSQL connections can be closed while idle. Checking
        # a connection before borrowing it avoids handing a stale connection
        # to a request after a restart or database maintenance event.
        "pool_pre_ping": not is_sqlite,
    }
    if is_sqlite:
        engine_options["connect_args"] = _SQLITE_CONNECT_ARGS

    backend = "SQLite" if is_sqlite else "PostgreSQL"
    logger.info("Creating SQLAlchemy engine backend=%s", backend)
    return create_engine(database_url, **engine_options)


# Module-level engine and session factory, shared across the application.
engine: Engine = _create_database_engine()

SessionLocal: sessionmaker[Session] = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
    future=True,
)


class Base(DeclarativeBase):
    """Shared declarative base for all ORM models.

    All models defined in `app/models/db_models.py` must inherit from
    this class so that their metadata is registered together and can be
    created via `initialize_database()`.
    """


@contextmanager
def db_session() -> Generator[Session, None, None]:
    """Provide a transactional database session as a context manager.

    Opens a new session, yields it to the caller, commits on successful
    completion, and rolls back on any exception before re-raising it.
    The session is always closed, regardless of outcome.

    Yields:
        An active SQLAlchemy `Session` bound to the application engine.

    Raises:
        SQLAlchemyError: If a database error occurs during the session,
            after the transaction has been rolled back.
    """
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except SQLAlchemyError:
        logger.warning("Database session error encountered; rolling back transaction.")
        session.rollback()
        raise
    finally:
        session.close()


def get_db(request: Request) -> Generator[Session, None, None]:
    """Yield a database session for use as a FastAPI dependency.

    Intended for use with FastAPI's `Depends`, e.g.:
        `def endpoint(db: Session = Depends(get_db)): ...`

    Delegates session lifecycle management to `db_session`, ensuring
    consistent commit/rollback/close behavior across all routes.

    Yields:
        An active SQLAlchemy `Session` bound to the application engine.
    """
    with db_session() as session:
        if request is not None and getattr(request.state, "workspace_id", None):
            session.info["workspace_id"] = request.state.workspace_id
        yield session


def initialize_database() -> None:
    """Create missing database tables and verify connectivity.

    Import the ORM module explicitly so every model is registered before
    creating missing tables. ``create_all`` is intentionally additive: it
    does not drop, truncate, or overwrite existing tables or rows. Schema
    changes for an existing production database must be handled by an
    explicit migration process, never by startup.

    This function must be called explicitly during application startup.
    It is never invoked automatically on module import.

    Raises:
        SQLAlchemyError: If table creation or the connectivity check
            fails. The original exception is logged before being
            re-raised.
    """
    try:
        # Keep model registration local to initialization to avoid relying on
        # router import order when this function is called from a script or
        # test suite.
        from app.models import db_models  # noqa: F401

        logger.info("Ensuring database schema exists without modifying existing data.")
        Base.metadata.create_all(bind=engine)

        # ``create_all`` is intentionally non-destructive but does not add
        # columns to an existing deployment. Add the ownership column
        # separately; NULL rows are quarantined legacy data and are never
        # returned by a workspace-scoped request.
        inspector = inspect(engine)
        repository_columns = {column["name"] for column in inspector.get_columns("repositories")}
        if "workspace_id" not in repository_columns:
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE repositories ADD COLUMN workspace_id VARCHAR(32)"))

        # The original schema enforced repository_url globally. That
        # constraint is incompatible with isolated workspaces: two
        # workspaces may independently import the same public repository.
        # Render uses PostgreSQL, where this additive/idempotent migration is
        # safe to run during startup. Legacy rows remain quarantined.
        if engine.dialect.name == "postgresql":
            constraints = {item["name"] for item in inspector.get_unique_constraints("repositories")}
            with engine.begin() as connection:
                if "uq_repositories_repository_url" in constraints:
                    connection.execute(text("ALTER TABLE repositories DROP CONSTRAINT uq_repositories_repository_url"))
                if "uq_repositories_workspace_url" not in constraints:
                    connection.execute(text("ALTER TABLE repositories ADD CONSTRAINT uq_repositories_workspace_url UNIQUE (workspace_id, repository_url)"))

        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))

        logger.info("Database initialized successfully.")
    except SQLAlchemyError as exc:
        logger.error("Database initialization failed: %s", exc)
        raise


def init_db() -> None:
    """Compatibility alias used by the FastAPI lifespan."""
    initialize_database()


def close_db() -> None:
    """Dispose pooled database connections during application shutdown."""
    engine.dispose()
