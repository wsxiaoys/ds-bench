"""Dynamic Tab-Based Match Panel built with Reflex."""

import reflex as rx


class State(rx.State):
    """The app state."""

    active_tab: str = "profile"

    def set_tab(self, tab: str) -> None:
        """Update active_tab to the lowercased label of the clicked tab."""
        self.active_tab = tab.lower()


def index() -> rx.Component:
    """The main page rendering three tabs and a match-based panel."""
    return rx.container(
        rx.color_mode.button(position="top-right"),
        rx.vstack(
            rx.heading("Dynamic Tab-Based Match Panel", size="8"),
            rx.hstack(
                rx.button(
                    "Profile",
                    on_click=State.set_tab("Profile"),
                ),
                rx.button(
                    "Settings",
                    on_click=State.set_tab("Settings"),
                ),
                rx.button(
                    "About",
                    on_click=State.set_tab("About"),
                ),
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
            justify="center",
            min_height="85vh",
        ),
    )


app = rx.App()
app.add_page(index)
