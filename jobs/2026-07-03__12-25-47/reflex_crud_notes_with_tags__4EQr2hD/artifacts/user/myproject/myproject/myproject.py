"""Welcome to Reflex! This file outlines the steps to create a basic app."""

import reflex as rx

from rxconfig import config

from myproject.models import Note, Tag, NoteTagLink  # noqa: F401
from myproject.state import State


def index() -> rx.Component:
    return rx.container(
        rx.color_mode.button(position="top-right"),
        rx.vstack(
            rx.heading("Notes & Tags", size="9"),
            rx.text("Manage notes with many-to-many tags", size="5"),
            spacing="5",
            justify="center",
            min_height="85vh",
        ),
    )


app = rx.App()
app.add_page(index)
