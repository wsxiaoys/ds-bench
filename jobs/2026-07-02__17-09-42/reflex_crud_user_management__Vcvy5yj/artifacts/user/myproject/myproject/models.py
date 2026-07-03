"""Database models for the myproject Reflex app."""

import reflex as rx


class User(rx.Model, table=True):
    """A user record persisted in the SQLite database."""

    username: str
    email: str
    is_active: bool = True