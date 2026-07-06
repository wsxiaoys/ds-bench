"""Welcome to Reflex! This file outlines the steps to create a basic app."""

import secrets

import httpx
import jwt
import reflex as rx
from fastapi import FastAPI, Header, HTTPException, status
from pydantic import BaseModel

from rxconfig import config

# Generate a secure random signing secret for JWTs at application startup.
JWT_SECRET = secrets.token_urlsafe(32)
JWT_ALGORITHM = "HS256"

VALID_USERNAME = "admin"
VALID_PASSWORD = "secret"

# Build a stand-alone FastAPI sub-app exposing the JWT auth endpoints.
fastapi_app = FastAPI()


class LoginRequest(BaseModel):
    username: str
    password: str


@fastapi_app.post("/api/login")
async def api_login(payload: LoginRequest):
    if payload.username != VALID_USERNAME or payload.password != VALID_PASSWORD:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    token = jwt.encode(
        {"sub": payload.username},
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )
    return {"access_token": token}


@fastapi_app.get("/api/me")
async def api_me(authorization: str | None = Header(default=None)):
    if authorization is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = parts[1]
    try:
        decoded = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = decoded.get("sub", "admin")
    return {"user": user}


class State(rx.State):
    """The app state."""

    # Frontend-visible state var so the page can render whether we're logged in.
    is_logged_in: bool = False

    # Backend-only state var (leading underscore) that holds the decoded user.
    _current_user: str = ""

    @rx.event
    async def login_and_fetch_me(self):
        """Log in against the FastAPI sub-app and update state accordingly."""
        try:
            async with httpx.AsyncClient() as client:
                login_resp = await client.post(
                    "http://localhost:8000/api/login",
                    json={"username": VALID_USERNAME, "password": VALID_PASSWORD},
                )
                if login_resp.status_code != 200:
                    self.is_logged_in = False
                    self._current_user = ""
                    return
                token = login_resp.json().get("access_token")
                me_resp = await client.get(
                    "http://localhost:8000/api/me",
                    headers={"Authorization": f"Bearer {token}"},
                )
                if me_resp.status_code == 200:
                    self._current_user = me_resp.json().get("user", "")
                    self.is_logged_in = True
                else:
                    self.is_logged_in = False
                    self._current_user = ""
        except Exception:
            self.is_logged_in = False
            self._current_user = ""


def index() -> rx.Component:
    # Welcome Page (Index)
    return rx.container(
        rx.color_mode.button(position="top-right"),
        rx.vstack(
            rx.heading("Welcome to Reflex!", size="9"),
            rx.text(
                "Get started by editing ",
                rx.code(f"{config.app_name}/{config.app_name}.py"),
                size="5",
            ),
            rx.link(
                rx.button("Check out our docs!"),
                href="https://reflex.dev/docs/getting-started/introduction/",
                is_external=True,
            ),
            rx.text(f"is_logged_in: {State.is_logged_in}"),
            rx.button("Login", on_click=State.login_and_fetch_me),
            spacing="5",
            justify="center",
            min_height="85vh",
        ),
    )


app = rx.App(api_transformer=fastapi_app)
app.add_page(index)
