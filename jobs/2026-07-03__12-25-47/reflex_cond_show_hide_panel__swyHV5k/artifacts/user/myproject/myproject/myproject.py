"""Welcome to Reflex! This file outlines the steps to create a basic app."""

import reflex as rx

from rxconfig import config


class State(rx.State):
    """The app state."""

    show_panel: bool = False

    @rx.var(cache=True)
    def visibility_label(self) -> str:
        if self.show_panel:
            return "Visibility: shown"
        return "Visibility: hidden"

    def set_show_panel(self, value: bool) -> None:
        self.show_panel = value


def index() -> rx.Component:
    return rx.container(
        rx.vstack(
            rx.heading("Reflex Conditional Panel", size="7"),
            rx.switch(
                is_checked=State.show_panel,
                on_change=State.set_show_panel,
            ),
            rx.text(State.visibility_label),
            rx.cond(
                State.show_panel,
                rx.box(
                    rx.text("Secret Panel Content"),
                    padding="1em",
                    border="1px solid #ccc",
                    border_radius="8px",
                ),
            ),
            spacing="4",
            align="start",
        ),
    )


app = rx.App()
app.add_page(index)
