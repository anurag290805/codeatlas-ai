from fastapi import Response
from starlette.requests import Request

import time

from fastapi.testclient import TestClient

from app.core.workspace import _decode, _set_cookie, _sign
from app.main import app


def _request(scheme: str) -> Request:
    return Request({"type": "http", "scheme": scheme, "path": "/api/session", "headers": [], "query_string": b"", "server": ("api.example", 443)})


def test_https_workspace_cookie_is_cross_site_compatible_and_secure() -> None:
    response = Response()
    _set_cookie(response, "a" * 32, _request("https"))
    header = response.headers["set-cookie"]
    assert "HttpOnly" in header
    assert "Secure" in header
    assert "SameSite=none" in header


def test_workspace_cookie_tampering_is_rejected() -> None:
    response = Response()
    _set_cookie(response, "b" * 32, _request("https"))
    cookie = response.headers["set-cookie"].split(";", 1)[0].split("=", 1)[1]
    assert _decode(cookie) == "b" * 32
    assert _decode(cookie[:-1] + ("0" if cookie[-1] != "0" else "1")) is None


def test_expired_workspace_cookie_is_rejected() -> None:
    workspace_id = "c" * 32
    issued_at = int(time.time()) - (60 * 60 * 24 * 31)
    assert _decode(f"{workspace_id}.{issued_at}.{_sign(workspace_id, issued_at)}") is None


def test_repository_listing_rotates_an_invalid_cookie_without_500() -> None:
    with TestClient(app) as client:
        response = client.get(
            "/api/repositories",
            cookies={"codeatlas_workspace": "invalid-cookie"},
        )
    assert response.status_code == 200
    assert response.json()["items"] == []
    assert "codeatlas_workspace=" in response.headers.get("set-cookie", "")
