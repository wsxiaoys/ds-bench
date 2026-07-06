import reflex as rx
from typing import Optional
from sqlmodel import Field

class Product(rx.Model, table=True):
    name: str
    category: str
    sku: str
    price: float
    in_stock: bool
