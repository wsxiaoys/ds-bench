"""Shared SQLModel select/where/order_by construction used by both the
State background event handler and the ``GET /api/filter`` HTTP endpoint."""

from __future__ import annotations

from typing import Optional

import sqlmodel
import sqlalchemy

from .models import Product

# Columns allowed for ``sort_by`` and the SQLAlchemy attribute they map to.
_SORT_COLUMNS: dict[str, sqlalchemy.orm.InstrumentedAttribute] = {
    "id": Product.id,
    "name": Product.name,
    "price": Product.price,
    "category": Product.category,
}


def build_filter_query(
    *,
    search: str = "",
    category: str = "All",
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    in_stock_only: bool = False,
    sort_by: str = "id",
    sort_dir: str = "asc",
) -> sqlmodel.Select:
    """Build a ``sqlmodel.Select`` for ``Product`` with the given filters.

    The semantics here are the single source of truth and are reused by the
    Reflex State background event and the ``GET /api/filter`` HTTP endpoint.
    """

    statement = sqlmodel.select(Product)

    # ``search``: case-insensitive substring on ``name``. Empty string disables it.
    if search:
        statement = statement.where(
            sqlalchemy.func.lower(Product.name).like(
                f"%{search.lower()}%",
            )
        )

    # ``category``: literal "All" or empty string disables the filter.
    if category and category != "All":
        statement = statement.where(Product.category == category)

    if min_price is not None:
        statement = statement.where(Product.price >= min_price)

    if max_price is not None:
        statement = statement.where(Product.price <= max_price)

    if in_stock_only:
        statement = statement.where(Product.in_stock.is_(True))

    column = _SORT_COLUMNS.get(sort_by, Product.id)
    if sort_dir == "desc":
        statement = statement.order_by(sqlalchemy.desc(column))
    else:
        statement = statement.order_by(sqlalchemy.asc(column))

    return statement


def row_to_dict(row: Product) -> dict:
    """Convert a ``Product`` ORM row into a JSON-friendly dict."""
    return {
        "id": row.id,
        "name": row.name,
        "category": row.category,
        "sku": row.sku,
        "price": row.price,
        "in_stock": row.in_stock,
    }