"""Conditional panel demo with a switch and a cached visibility label."""

import reflex as rx

from rxconfig import config


class State(rx.State):
    """The app state."""

    # Boolean state var that drives the conditional rendering.
    show_panel: bool = False

    @rx.event
    def toggle_panel(self, value: bool) -> None:
        """Update show_panel from the switch's on_change event."""
        self.show_panel = value

    @rx.var(cache=True)
    def visibility_label(self) -> str:
        """Human-readable label derived from show_panel.

        This is a cached computed var, so it only recomputes when
        `show_panel` changes, keeping the label in sync with the panel.
        """
        return "Visibility: shown" if self.show_panel else "Visibility: hidden"


def index() -> rx.Component:
    """The main page with the switch, conditional panel, and status label."""
    return rx.container(
        rx.color_mode.button(position="top-right"),
        rx.vstack(
            rx.heading("Conditional Panel", size="8"),
            # Switch control bound to show_panel via on_change.
            rx.hstack(
                rx.text("Show panel"),
                rx.switch(
                    checked=State.show_panel,
                    on_change=State.toggle_panel,
                ),
                align="center",
                spacing="3",
            ),
            # Status label sourced from the cached computed var.
            rx.text(State.visibility_label, as_="p", size="4"),
            # Conditionally render the panel only when show_panel is True.
            rx.cond(
                State.show_panel,
                rx.box(
                    rx.text("Secret Panel Content", size="5"),
                    padding="1em 2em",
                    border="1px solid #888",
                    border_radius="0.5em",
                    background_color="#f5f5f5",
                    width="100%",
                ),
                rx.box(),  # empty placeholder when hidden
            ),
            spacing="5",
            justify="center",
            min_height="85vh",
        ),
    )


app = rx.App()
app.add_page(index)