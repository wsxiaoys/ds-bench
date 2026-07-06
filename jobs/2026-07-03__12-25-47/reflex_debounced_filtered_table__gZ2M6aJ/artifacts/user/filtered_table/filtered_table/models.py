"""SQLModel-backed database models for the filtered table app."""

from typing import Optional

import reflex as rx
from sqlmodel import Field


CATEGORIES = ["Electronics", "Books", "Clothing", "Home", "Toys", "Sports"]


class Product(rx.Model, table=True):
    """A product in the catalog."""

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    category: str
    sku: str
    price: float
    in_stock: bool
