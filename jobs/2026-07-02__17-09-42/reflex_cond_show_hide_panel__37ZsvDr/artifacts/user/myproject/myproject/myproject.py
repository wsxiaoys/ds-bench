"""Welcome to Reflex! This file outlines the steps to create a basic app."""

import reflex as rx

from rxconfig import config


class State(rx.State):
    """The app state."""

    show_panel: bool = False

    @rx.var(cache=True)
    def visibility_label(self) -> str:
        """Return a human-readable label describing whether the panel is shown."""
        return f"Visibility: {'shown' if self.show_panel else 'hidden'}"

    def set_show_panel(self, value: bool) -> None:
        """Update the ``show_panel`` boolean from the switch's on_change event."""
        self.show_panel = value


def index() -> rx.Component:
    return rx.container(
        rx.color_mode.button(position="top-right"),
        rx.vstack(
            rx.heading("Reflex Conditional Panel", size="9"),
            rx.hstack(
                rx.text("Show panel"),
                rx.switch(
                    checked=State.show_panel,
                    on_change=State.set_show_panel,
                ),
                spacing="3",
            ),
            rx.text(State.visibility_label),
            rx.cond(
                State.show_panel,
                rx.box(
                    rx.text("Secret Panel Content"),
                    padding="4",
                    border="1px solid",
                    border_radius="md",
                ),
                rx.fragment(),
            ),
            spacing="5",
        ),
    )


app = rx.App()
app.add_page(index)