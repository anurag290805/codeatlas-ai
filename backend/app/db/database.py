"""Database configuration and lifecycle management for CodeAtlas AI.

This module owns the SQLAlchemy engine, session factory, and declarative
base used across the entire persistence layer. It is intentionally free
of business logic, ORM model definitions, and CRUD operations: its sole
responsibility is wiring up the database infrastructure so that other
modules — most notably `app/models/db_models.py` and FastAPI route
handlers — can depend on a consistently configured `Base`, `engine`, and
`SessionLocal`.

The engine is configured for SQLite by default but built using standard
SQLAlchemy 2.x APIs so that migrating to PostgreSQL later requires only a
change to the `DATABASE_URL` setting and the removal of the
SQLite-specific `connect_args`.
"""

from collections.abc import Generator
from contextlib import contextmanager

from sqlalchemy import Engine, create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings
from app.utils.logger import get_logger

logger = get_logger(__name__)

# SQLite-specific connection arguments. These are only meaningful when the
# configured DATABASE_URL targets SQLite; they are harmless to construct
# unconditionally but should be dropped if/when the engine is pointed at
# a different database backend (e.g. PostgreSQL).
_SQLITE_CONNECT_ARGS = {"check_same_thread": False}


def _create_database_engine() -> Engine:
    """Build and return the SQLAlchemy engine for the application.

    Reads the database connection string from the application settings
    and configures engine options appropriate for SQLite. The engine is
    created once at module load time and reused for the lifetime of the
    process.

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

    connect_args = _SQLITE_CONNECT_ARGS if database_url.startswith("sqlite") else {}

    logger.info("Creating SQLAlchemy engine for database at: %s", database_url)
    return create_engine(
        database_url,
        connect_args=connect_args,
        future=True,
    )


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


def get_db() -> Generator[Session, None, None]:
    """Yield a database session for use as a FastAPI dependency.

    Intended for use with FastAPI's `Depends`, e.g.:
        `def endpoint(db: Session = Depends(get_db)): ...`

    Delegates session lifecycle management to `db_session`, ensuring
    consistent commit/rollback/close behavior across all routes.

    Yields:
        An active SQLAlchemy `Session` bound to the application engine.
    """
    with db_session() as session:
        yield session


def initialize_database() -> None:
    """Create database tables and verify connectivity.

    Imports all ORM models indirectly via `Base.metadata` (models must
    already be defined and registered against `Base` before this is
    called), creates any tables that do not yet exist, and performs a
    lightweight connectivity check.

    This function must be called explicitly during application startup.
    It is never invoked automatically on module import.

    Raises:
        SQLAlchemyError: If table creation or the connectivity check
            fails. The original exception is logged before being
            re-raised.
    """
    try:
        logger.info("Initializing database schema.")
        Base.metadata.create_all(bind=engine)

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
