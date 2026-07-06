"""HTTP API endpoints mounted via ``rx.App(api_transformer=...)``."""

from __future__ import annotations

from typing import Optional

import reflex as rx
from fastapi import APIRouter, FastAPI, Query

from .models import Product
from .query import build_filter_query, row_to_dict


def build_api_router() -> APIRouter:
    """Return the ``APIRouter`` exposing the ``/api/filter`` endpoint."""

    router = APIRouter()

    @router.get("/api/filter")
    def filter_endpoint(
        search: str = Query("", description="Case-insensitive substring of name"),
        category: str = Query("All", description="Category name or 'All'"),
        min_price: Optional[float] = Query(None, ge=0),
        max_price: Optional[float] = Query(None, ge=0),
        in_stock_only: str = Query("false", description="Case-insensitive 'true'/'false'"),
        sort_by: str = Query("id"),
        sort_dir: str = Query("asc"),
    ):
        in_stock_flag = str(in_stock_only).strip().lower() == "true"

        statement = build_filter_query(
            search=search or "",
            category=category or "All",
            min_price=min_price,
            max_price=max_price,
            in_stock_only=in_stock_flag,
            sort_by=sort_by or "id",
            sort_dir=sort_dir or "asc",
        )

        with rx.session() as session:
            rows = session.exec(statement).all()

        items = [row_to_dict(row) for row in rows]
        return {"result_count": len(items), "filtered": items}

    return router


def build_api_app() -> FastAPI:
    """Build a small standalone FastAPI app exposing the filter endpoint.

    Useful as an ``api_transformer`` for ``rx.App(api_transformer=...)``.
    """
    app = FastAPI(title="filtered_table API")
    app.include_router(build_api_router())
    return app