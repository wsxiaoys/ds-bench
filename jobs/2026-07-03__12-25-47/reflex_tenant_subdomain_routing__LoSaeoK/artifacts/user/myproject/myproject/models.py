"""Database models for the myproject application."""

import reflex as rx


class Tenant(rx.Model, table=True):
    """Tenant model representing a tenant in the system."""

    slug: str
    name: str
