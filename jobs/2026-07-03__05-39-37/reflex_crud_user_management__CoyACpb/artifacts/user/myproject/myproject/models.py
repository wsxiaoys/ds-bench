"""Database models for the user management app."""

from __future__ import annotations

import reflex as rx


class User(rx.Model, table=True):
    """A user stored in the SQLite database.

    Attributes:
        id: The primary key (provided by rx.Model).
        username: The user's username.
        email: The user's email address.
        is_active: Whether the user account is active.
    """

    username: str
    email: str
    is_active: bool = True