"""Database models for the filtered_table app."""

from __future__ import annotations

from typing import Optional

import sqlmodel
import reflex as rx


class Product(rx.Model, table=True):
    """A single row in the catalog of products."""

    name: str
    category: str
    sku: str
    price: float
    in_stock: bool = True


# Categories used both for seeding and for the UI dropdown.
CATEGORIES: list[str] = [
    "Electronics",
    "Books",
    "Clothing",
    "Home",
    "Toys",
    "Sports",
]


def seed_products() -> None:
    """Deterministically insert 240 product rows if the table is empty.

    Insertion order is category outer, item inner, so primary keys are
    assigned 1..240 with ``Electronics #01`` = id 1 and ``Sports #40`` = id 240.
    """
    with rx.session() as session:
        # Idempotency: bail out if rows already exist.
        existing = session.exec(sqlmodel.select(Product)).first()
        if existing is not None:
            return

        rows: list[Product] = []
        for c, category in enumerate(CATEGORIES):
            for i in range(40):
                name = f"{category} #{i + 1:02d}"
                sku = f"{category[:3].upper()}-{i + 1:03d}"
                price = round(5.0 + (c * 5) + (i * 1.0), 2)
                in_stock = (i % 4) != 3
                rows.append(
                    Product(
                        name=name,
                        category=category,
                        sku=sku,
                        price=price,
                        in_stock=in_stock,
                    )
                )
        session.add_all(rows)
        session.commit()