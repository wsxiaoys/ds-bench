"""Welcome to Reflex! This file outlines the steps to create a basic app."""

import reflex as rx


class State(rx.State):
    """The app state."""
    show_panel: bool = False

    def set_show_panel(self, checked: bool):
        self.show_panel = checked

    @rx.var(cache=True)
    def visibility_label(self) -> str:
        return "Visibility: shown" if self.show_panel else "Visibility: hidden"


def index() -> rx.Component:
    return rx.container(
        rx.vstack(
            rx.heading("Reflex Conditional Panel Demo", size="6"),
            rx.switch(
                checked=State.show_panel,
                on_change=State.set_show_panel,
            ),
            rx.text(State.visibility_label),
            rx.cond(
                State.show_panel,
                rx.box(
                    rx.text("Secret Panel Content"),
                    border="1px solid #ccc",
                    padding="1em",
                    border_radius="5px",
                    width="100%",
                ),
            ),
            spacing="4",
            align="center",
            justify="center",
            min_height="50vh",
        )
    )


app = rx.App()
app.add_page(index)
