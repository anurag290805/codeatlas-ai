from fastapi import Response
from starlette.requests import Request

from app.core.workspace import _decode, _set_cookie


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
