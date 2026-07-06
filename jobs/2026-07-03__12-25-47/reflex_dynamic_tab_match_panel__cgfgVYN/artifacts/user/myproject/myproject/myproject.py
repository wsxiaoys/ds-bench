"""Tab-based match panel with Reflex."""

import reflex as rx

from rxconfig import config


class State(rx.State):
    """The app state."""

    active_tab: str = "profile"

    def set_tab(self, tab: str) -> None:
        """Set the active tab."""
        self.active_tab = tab


def index() -> rx.Component:
    return rx.container(
        rx.vstack(
            rx.hstack(
                rx.button("Profile", on_click=lambda: State.set_tab("profile")),
                rx.button("Settings", on_click=lambda: State.set_tab("settings")),
                rx.button("About", on_click=lambda: State.set_tab("about")),
                spacing="3",
            ),
            rx.match(
                State.active_tab,
                ("profile", rx.text("User Profile Page")),
                ("settings", rx.text("Settings Page")),
                ("about", rx.text("About Page")),
                rx.text("Unknown Tab"),
            ),
            spacing="5",
        ),
    )


app = rx.App()
app.add_page(index)
