"""FastAPI app mounted on the Reflex backend."""

from __future__ import annotations

import json
from typing import Any, Awaitable, Callable

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel import Session, select

from reflex.utils import console

from .models import Tenant

# Build a small SQLAlchemy/SQLModel engine pointing at the same SQLite file
# used by the Reflex application.  We deliberately reuse the same database
# rather than going through ``rx.session()`` so the middleware stays a plain
# FastAPI/Starlette component that only needs to read the tenant table.
import os
import reflex as rx
from rxconfig import config

_DB_URL = f"sqlite:///{os.path.join(os.path.dirname(config.app_name and __file__ or '.'), '..', f'{config.app_name}.db')}"
# Resolve the actual reflex sqlite path used by the app
try:
    from reflex.utils import prerequisites
    _DB_PATH = prerequisites.get_db_path()
    _DB_URL = f"sqlite:///{_DB_PATH}"
except Exception:
    pass

_engine = create_engine(_DB_URL, echo=False, future=True)
_SessionLocal = sessionmaker(bind=_engine, REDACTEDflush=False, REDACTEDcommit=False)


def _lookup_tenant_slug(slug: str) -> dict[str, str] | None:
    """Return a dict for the tenant matching ``slug`` or ``None``."""
    with Session(_engine) as session:
        statement = select(Tenant).where(Tenant.slug == slug)
        tenant = session.exec(statement).first()
        if tenant is None:
            return None
        return {"slug": tenant.slug, "name": tenant.name}


def create_fastapi_app() -> FastAPI:
    """Build the FastAPI app mounted onto the Reflex backend."""
    app = FastAPI(title="tenant-api")

    @app.middleware("http")
    async def tenant_middleware(
        request: Request,
        call_next: Callable[[Request], Awaitable[Any]],
    ):
        # Only inspect paths under /api/.  Let everything else through so that
        # the Reflex frontend, websocket endpoint and other internal routes keep
        # working unchanged.
        if not request.url.path.startswith("/api/"):
            return await call_next(request)

        tenant_slug = request.headers.get("x-tenant-id")
        if not tenant_slug:
            return JSONResponse(
                status_code=403,
                content={"detail": "forbidden"},
            )

        tenant = _lookup_tenant_slug(tenant_slug)
        if tenant is None:
            return JSONResponse(
                status_code=403,
                content={"detail": "forbidden"},
            )

        return await call_next(request)

    @app.get("/api/me")
    async def api_me(request: Request) -> JSONResponse:
        tenant_slug = request.headers.get("x-tenant-id", "")
        tenant = _lookup_tenant_slug(tenant_slug) or {"slug": tenant_slug, "name": ""}
        return JSONResponse(
            status_code=200,
            content={"slug": tenant["slug"], "name": tenant["name"]},
        )

    return app


fastapi_app = create_fastapi_app()
