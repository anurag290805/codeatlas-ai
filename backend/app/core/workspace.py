"""Signed browser-workspace isolation for the pre-account architecture."""
from __future__ import annotations
import base64, hashlib, hmac, secrets, time
from contextvars import ContextVar
from fastapi import Depends, Request, Response
from sqlalchemy.orm import Session
from app.config import get_settings
from app.db.database import db_session, get_db
from app.models.db_models import Workspace

WORKSPACE_COOKIE = "codeatlas_workspace"
_workspace_context: ContextVar[str | None] = ContextVar("workspace_id", default=None)
_EPHEMERAL_KEY = secrets.token_bytes(32)

def current_workspace_id() -> str | None:
    return _workspace_context.get()

def _key() -> bytes:
    configured = get_settings().workspace_session_secret
    return configured.encode() if configured else _EPHEMERAL_KEY

def _sign(workspace_id: str, issued_at: int) -> str:
    payload = f"{workspace_id}.{issued_at}".encode()
    return base64.urlsafe_b64encode(hmac.new(_key(), payload, hashlib.sha256).digest()).decode().rstrip("=")

def _decode(value: str | None) -> str | None:
    try:
        workspace_id, timestamp, signature = (value or "").split(".", 2)
        issued_at = int(timestamp)
        if abs(time.time() - issued_at) > 60 * 60 * 24 * 30 or not hmac.compare_digest(signature, _sign(workspace_id, issued_at)):
            return None
        return workspace_id if len(workspace_id) == 32 and all(c in "0123456789abcdef" for c in workspace_id) else None
    except (TypeError, ValueError):
        return None

def _set_cookie(response: Response, workspace_id: str) -> None:
    issued_at = int(time.time())
    response.set_cookie(WORKSPACE_COOKIE, f"{workspace_id}.{issued_at}.{_sign(workspace_id, issued_at)}", httponly=True, secure=get_settings().environment == "production", samesite="none" if get_settings().environment == "production" else "lax", max_age=60 * 60 * 24 * 30, path="/")

async def ensure_workspace(request: Request, response: Response, db: Session = Depends(get_db)) -> str:
    if getattr(request.state, "workspace_id", None):
        return request.state.workspace_id
    workspace_id = _decode(request.cookies.get(WORKSPACE_COOKIE))
    if workspace_id is None or db.get(Workspace, workspace_id) is None:
        workspace_id = secrets.token_hex(16)
        db.add(Workspace(id=workspace_id))
        db.commit()
        _set_cookie(response, workspace_id)
    _workspace_context.set(workspace_id)
    request.state.workspace_id = workspace_id
    return workspace_id


def initialize_request_workspace(request: Request) -> tuple[str, bool]:
    """Bind a request workspace before FastAPI dispatches sync/async handlers."""
    workspace_id = _decode(request.cookies.get(WORKSPACE_COOKIE))
    created = False
    with db_session() as db:
        if workspace_id is None or db.get(Workspace, workspace_id) is None:
            workspace_id = secrets.token_hex(16)
            db.add(Workspace(id=workspace_id))
            created = True
    request.state.workspace_id = workspace_id
    return workspace_id, created


def set_workspace_cookie(response: Response, workspace_id: str) -> None:
    _set_cookie(response, workspace_id)
