"""Request-scoped workspace identity for anonymous and authenticated clients.

This is deliberately a small foundation: until an account provider is added,
the signed, HttpOnly cookie identifies one browser workspace. The value is
never accepted from request bodies, query strings, or headers.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
from fastapi import Request

from app.config import get_settings

WORKSPACE_COOKIE = "codeatlas_workspace"
_SEPARATOR = "."


def _signature(workspace_id: str) -> str:
    secret = get_settings().session_secret.encode("utf-8")
    return hmac.new(secret, workspace_id.encode("utf-8"), hashlib.sha256).hexdigest()


def _new_workspace_id() -> str:
    return secrets.token_urlsafe(32)


def workspace_cookie_value(workspace_id: str) -> str:
    return f"{workspace_id}{_SEPARATOR}{_signature(workspace_id)}"


def get_workspace_id(request: Request) -> str:
    """Return the verified workspace id attached by request middleware."""
    workspace_id = getattr(request.state, "workspace_id", None)
    if workspace_id:
        return workspace_id

    # Useful for direct route-function tests; production requests always pass
    # through the middleware below.
    raw = request.cookies.get(WORKSPACE_COOKIE, "")
    workspace, separator, signature = raw.rpartition(_SEPARATOR)
    if separator and workspace and hmac.compare_digest(signature, _signature(workspace)):
        request.state.workspace_id = workspace
        return workspace
    workspace_id = _new_workspace_id()
    request.state.workspace_id = workspace_id
    request.state.workspace_cookie_value = workspace_cookie_value(workspace_id)
    return workspace_id


def ensure_workspace_cookie(request: Request) -> str:
    """Verify or create the workspace identity before route execution."""
    return get_workspace_id(request)
