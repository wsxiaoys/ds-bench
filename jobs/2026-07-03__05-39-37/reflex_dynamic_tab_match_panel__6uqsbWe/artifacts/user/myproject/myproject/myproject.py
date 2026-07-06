"""Tab-based match panel demo built with Reflex."""

import reflex as rx


class State(rx.State):
    """The app state."""

    # The currently active tab. Defaults to "profile".
    active_tab: str = "profile"

    def set_tab(self, tab: str):
        """Set the active tab to the lowercased label of the clicked button."""
        self.active_tab = tab.lower()


def index() -> rx.Component:
    """The main page rendering tabs and a match-based panel."""
    return rx.container(
        rx.vstack(
            rx.heading("Tab-Based Match Panel", size="7"),
            # Three tab buttons labelled Profile, Settings, About.
            rx.hstack(
                rx.button(
                    "Profile",
                    on_click=State.set_tab("profile"),
                    variant=rx.cond(
                        State.active_tab == "profile", "solid", "surface"
                    ),
                ),
                rx.button(
                    "Settings",
                    on_click=State.set_tab("settings"),
                    variant=rx.cond(
                        State.active_tab == "settings", "solid", "surface"
                    ),
                ),
                rx.button(
                    "About",
                    on_click=State.set_tab("about"),
                    variant=rx.cond(
                        State.active_tab == "about", "solid", "surface"
                    ),
                ),
                spacing="4",
            ),
            rx.divider(),
            # Match-based panel: explicit case branches plus a default branch.
            rx.match(
                State.active_tab,
                ("profile", rx.text("User Profile Page")),
                ("settings", rx.text("Settings Page")),
                ("about", rx.text("About Page")),
                rx.text("Unknown Tab"),
            ),
            spacing="4",
            justify="center",
            min_height="85vh",
        ),
    )


app = rx.App()
app.add_page(index)