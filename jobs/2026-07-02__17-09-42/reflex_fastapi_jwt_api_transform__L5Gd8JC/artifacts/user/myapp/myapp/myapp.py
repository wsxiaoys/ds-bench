"""Welcome to Reflex!

This file wires a custom FastAPI sub-app into the Reflex backend via the
``api_transformer`` argument so we can expose a small JWT-based auth API
(``POST /api/login`` and ``GET /api/me``) on the same port as the Reflex
app (http://localhost:8000 by default).

The decoded user identity is stored in a backend-only state var
(``_current_user`` — leading underscore means it never reaches the browser),
while a frontend-visible ``is_logged_in`` flag is updated so the page can
show whether login has succeeded.
"""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

import httpx
import jwt
import reflex as rx
from fastapi import FastAPI, HTTPException, Request, status
from pydantic import BaseModel

from rxconfig import config


# ---------------------------------------------------------------------------
# JWT auth setup
# ---------------------------------------------------------------------------

# Sign / verify JWTs with HS256 using a secret generated at startup with a
# cryptographically-secure random source. The secret never leaves the
# backend process: it is not read from os.environ and not hardcoded.
JWT_SECRET: str = secrets.token_urlsafe(32)
JWT_ALGORITHM: str = "HS256"
JWT_EXPIRATION = timedelta(hours=1)

# Only one valid credential pair exists for this demo app.
VALID_USERNAME: str = "admin"
VALID_PASSWORD: str = "secret"


class LoginRequest(BaseModel):
    """Body schema for ``POST /api/login``."""

    username: str
    password: str


def _create_access_token(subject: str) -> str:
    """Return a signed JWT for ``subject`` with an expiry claim."""
    expire = datetime.now(timezone.utc) + JWT_EXPIRATION
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _decode_token(token: str) -> dict | None:
    """Return the decoded JWT payload, or ``None`` if the token is invalid."""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None


# ---------------------------------------------------------------------------
# Custom FastAPI sub-app mounted via api_transformer
# ---------------------------------------------------------------------------

fastapi_app = FastAPI(title="MyApp Auth API")


@fastapi_app.post("/api/login")
def login(body: LoginRequest) -> dict:
    """Validate credentials and return a signed access token."""
    if body.username != VALID_USERNAME or body.password != VALID_PASSWORD:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = _create_access_token(body.username)
    return {"access_token": token}


@fastapi_app.get("/api/me")
def me(request: Request) -> dict:
    """Return the authenticated user, or 401/403 if the bearer token is bad."""
    auth_header = request.headers.get("authorization") or request.headers.get(
        "Authorization"
    )
    if not auth_header:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    parts = auth_header.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = parts[1].strip()
    payload = _decode_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = payload.get("sub")
    if not user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Token missing subject",
        )
    return {"user": user}


# ---------------------------------------------------------------------------
# Reflex state
# ---------------------------------------------------------------------------


class State(rx.State):
    """The app state.

    ``_current_user`` is backend-only (leading underscore) — it lives in
    the Python process and is never sent to the browser. ``is_logged_in``
    is a normal frontend-visible var so the page can react to the result.
    """

    is_logged_in: bool = False
    _current_user: str = ""
    _access_token: str = ""

    @rx.event
    async def try_login(self) -> None:
        """Call the auth API and update state based on the result.

        The credentials are intentionally fixed for the demo (admin/secret).
        """
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                login_resp = await client.post(
                    "http://localhost:8000/api/login",
                    json={"username": "admin", "password": "secret"},
                )
            except httpx.HTTPError:
                self.is_logged_in = False
                self._current_user = ""
                self._access_token = ""
                return

            if login_resp.status_code != 200:
                self.is_logged_in = False
                self._current_user = ""
                self._access_token = ""
                return

            token = login_resp.json().get("access_token", "")
            if not token:
                self.is_logged_in = False
                self._current_user = ""
                self._access_token = ""
                return

            self._access_token = token

            try:
                me_resp = await client.get(
                    "http://localhost:8000/api/me",
                    headers={"Authorization": f"Bearer {token}"},
                )
            except httpx.HTTPError:
                self.is_logged_in = False
                self._current_user = ""
                return

            if me_resp.status_code != 200:
                self.is_logged_in = False
                self._current_user = ""
                return

            self._current_user = me_resp.json().get("user", "")
            self.is_logged_in = bool(self._current_user)


# ---------------------------------------------------------------------------
# Reflex UI
# ---------------------------------------------------------------------------


def index() -> rx.Component:
    """Home page – renders the live ``is_logged_in`` value."""
    return rx.container(
        rx.color_mode.button(position="top-right"),
        rx.vstack(
            rx.heading("JWT Auth demo", size="9"),
            rx.text("is_logged_in (frontend-visible state):"),
            rx.code(State.is_logged_in.to_string(), id="is-logged-in-value"),
            rx.text("Login to set it to True."),
            rx.button("Login", on_click=State.try_login, id="login-button"),
            rx.divider(),
            rx.text(
                "The decoded username is stored in the backend-only "
                "state var _current_user and is never sent to the browser."
            ),
            spacing="5",
            justify="center",
            min_height="85vh",
        ),
        id="root-container",
    )


# ---------------------------------------------------------------------------
# Build the Reflex app with the FastAPI sub-app as the api_transformer
# ---------------------------------------------------------------------------

app = rx.App(api_transformer=fastapi_app)
app.add_page(index)
