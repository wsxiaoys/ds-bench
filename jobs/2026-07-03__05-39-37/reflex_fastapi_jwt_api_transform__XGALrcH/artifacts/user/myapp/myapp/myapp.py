"""Reflex app with a custom FastAPI JWT router mounted via ``api_transformer``.

This module builds a stand-alone FastAPI sub-app that exposes a small JWT auth
flow (``POST /api/login`` + ``GET /api/me``) and mounts it onto the Reflex
backend by passing the FastAPI instance to ``rx.App(api_transformer=...)``.

The signing secret for the JWTs is generated once at module import time using
``secrets.token_urlsafe`` (a Python secure-random API). It is never read from the
environment and never hardcoded.
"""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
import jwt
import reflex as rx
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# JWT configuration
# ---------------------------------------------------------------------------
# Generate the HS256 signing secret at application startup using a secure-random
# API. ``secrets.token_urlsafe`` returns a cryptographically strong text-safe
# string. This runs once when the module is imported (i.e. when the Reflex
# backend boots) and is reused for the lifetime of the process.
JWT_SECRET: str = secrets.token_urlsafe(32)
JWT_ALGORITHM: str = "HS256"
JWT_EXPIRE_MINUTES: int = 60

# The only valid credentials for ``POST /api/login``.
VALID_USERNAME: str = "admin"
VALID_PASSWORD: str = "secret"


def _create_access_token(username: str) -> str:
    """Sign and return a JWT for the given username."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES)
    payload = {"sub": username, "exp": expire}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _decode_token(token: str) -> dict:
    """Verify and decode a JWT, raising ``HTTPException`` on failure."""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=401, detail="Token has expired") from exc
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc


# ---------------------------------------------------------------------------
# FastAPI sub-app
# ---------------------------------------------------------------------------
fastapi_app = FastAPI(title="myapp JWT API")


class LoginRequest(BaseModel):
    """Request body for ``POST /api/login``."""

    username: str
    password: str


@fastapi_app.post("/api/login")
async def login(request: LoginRequest) -> dict:
    """Authenticate the user and return a signed JWT.

    Returns ``{"access_token": str}`` on success. Invalid credentials produce
    HTTP 401.
    """
    if request.username != VALID_USERNAME or request.password != VALID_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = _create_access_token(request.username)
    return {"access_token": token}


@fastapi_app.get("/api/me")
async def me(authorization: Optional[str] = Header(default=None)) -> dict:
    """Return the authenticated user identity.

    Requires an ``Authorization: Bearer <token>`` header. A missing, malformed
    or invalid token produces HTTP 401.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization header missing or malformed")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Authorization header missing or malformed")
    payload = _decode_token(token)
    return {"user": payload.get("sub")}


# ---------------------------------------------------------------------------
# Reflex state
# ---------------------------------------------------------------------------
class State(rx.State):
    """Application state.

    ``_current_user`` is a *backend-only* state var (its name begins with an
    underscore, so Reflex never syncs it to the browser). It holds the decoded
    user identity obtained from ``GET /api/me``.

    ``is_logged_in`` is a regular (frontend-visible) state var that the index
    page renders so a viewer can tell whether login has occurred.
    """

    # Backend-only: holds the decoded user identity once authenticated.
    _current_user: str = ""

    # Frontend-visible state.
    is_logged_in: bool = False
    username: str = "admin"
    password: str = ""
    login_message: str = "Not logged in."

    async def login(self) -> None:
        """Authenticate against the mounted FastAPI router.

        Calls ``POST /api/login`` and then ``GET /api/me`` against the Reflex
        backend (``http://localhost:8000``) and updates ``is_logged_in`` and
        ``_current_user`` accordingly.

        This handler is ``async`` and uses ``httpx.AsyncClient`` so the event
        loop stays free to process the sub-request against the same backend.
        """
        try:
            async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
                # 1. Obtain a JWT from POST /api/login.
                login_resp = await client.post(
                    "/api/login",
                    json={"username": self.username, "password": self.password},
                )
                if login_resp.status_code != 200:
                    self.is_logged_in = False
                    self._current_user = ""
                    self.login_message = f"Login failed (HTTP {login_resp.status_code})."
                    return

                token = login_resp.json().get("access_token", "")

                # 2. Verify the token via GET /api/me.
                me_resp = await client.get(
                    "/api/me",
                    headers={"Authorization": f"Bearer {token}"},
                )
                if me_resp.status_code == 200:
                    self._current_user = me_resp.json().get("user", "")
                    self.is_logged_in = True
                    self.login_message = f"Logged in as {self._current_user}."
                else:
                    self.is_logged_in = False
                    self._current_user = ""
                    self.login_message = f"/api/me failed (HTTP {me_resp.status_code})."
        except Exception as exc:  # noqa: BLE001 - surface any error to the UI.
            self.is_logged_in = False
            self._current_user = ""
            self.login_message = f"Error during login: {exc}"


# ---------------------------------------------------------------------------
# UI
# ---------------------------------------------------------------------------
def index() -> rx.Component:
    """Render the index page showing the login status."""
    return rx.container(
        rx.color_mode.button(position="top-right"),
        rx.vstack(
            rx.heading("JWT Auth Demo", size="9"),
            rx.text(
                "is_logged_in: ",
                rx.code(State.is_logged_in),
                size="5",
            ),
            rx.text(State.login_message, size="3"),
            rx.divider(),
            rx.hstack(
                rx.input(
                    placeholder="username",
                    value=State.username,
                    on_change=State.set_username,
                ),
                rx.input(
                    placeholder="password",
                    type_="password",
                    value=State.password,
                    on_change=State.set_password,
                ),
            ),
            rx.button("Login", on_click=State.login),
            spacing="5",
            justify="center",
            min_height="85vh",
        ),
    )


# ---------------------------------------------------------------------------
# Reflex app — mount the FastAPI router via api_transformer.
# ---------------------------------------------------------------------------
app = rx.App(api_transformer=fastapi_app)
app.add_page(index)