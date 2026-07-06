"""CRUD user management application built with Reflex."""

from __future__ import annotations

import reflex as rx

from myproject.models import User


class State(rx.State):
    """The app state holding the user list and form inputs."""

    # The list of users displayed in the table (a base var backed by the DB).
    users: list[User] = []

    # Form input values for creating a new user.
    new_username: str = ""
    new_email: str = ""

    def set_new_username(self, value: str) -> None:
        """Setter for the new_username form input."""
        self.new_username = value

    def set_new_email(self, value: str) -> None:
        """Setter for the new_email form input."""
        self.new_email = value

    def load_users(self) -> None:
        """Refresh the user list from the database."""
        with rx.session() as session:
            self.users = session.exec(User.select()).all()

    def create_user(self) -> None:
        """Create a new user from the form inputs."""
        if not self.new_username or not self.new_email:
            return
        user = User(username=self.new_username, email=self.new_email)
        with rx.session() as session:
            session.add(user)
            session.commit()
        # Clear the form and refresh the table.
        self.new_username = ""
        self.new_email = ""
        self.load_users()

    def delete_user(self, user_id: int) -> None:
        """Delete the user with the given id."""
        with rx.session() as session:
            user = session.get(User, user_id)
            if user is not None:
                session.delete(user)
                session.commit()
        self.load_users()

    def toggle_active(self, user_id: int) -> None:
        """Toggle the is_active flag for the user with the given id."""
        with rx.session() as session:
            user = session.get(User, user_id)
            if user is not None:
                user.is_active = not user.is_active
                session.add(user)
                session.commit()
        self.load_users()


def index() -> rx.Component:
    """The main page: a form to create users and a table listing them."""
    return rx.container(
        rx.vstack(
            rx.heading("User Management", size="8"),
            # Create user form.
            rx.form(
                rx.hstack(
                    rx.input(
                        placeholder="Username",
                        value=State.new_username,
                        on_change=State.set_new_username,
                        name="username",
                    ),
                    rx.input(
                        placeholder="Email",
                        value=State.new_email,
                        on_change=State.set_new_email,
                        name="email",
                        type_="email",
                    ),
                    rx.button("Create", type_="submit"),
                    spacing="3",
                ),
                on_submit=State.create_user,
                reset_on_submit=False,
            ),
            # Users table.
            rx.table.root(
                rx.table.header(
                    rx.table.row(
                        rx.table.column_header_cell("ID"),
                        rx.table.column_header_cell("Username"),
                        rx.table.column_header_cell("Email"),
                        rx.table.column_header_cell("Active"),
                        rx.table.column_header_cell("Actions"),
                    ),
                ),
                rx.table.body(
                    rx.foreach(
                        State.users,
                        lambda user: rx.table.row(
                            rx.table.row_header_cell(user.id),
                            rx.table.cell(user.username),
                            rx.table.cell(user.email),
                            rx.table.cell(
                                rx.cond(
                                    user.is_active,
                                    rx.badge(
                                        "Active",
                                        color_scheme="grass",
                                        variant="soft",
                                    ),
                                    rx.badge(
                                        "Inactive",
                                        color_scheme="tomato",
                                        variant="soft",
                                    ),
                                ),
                            ),
                            rx.table.cell(
                                rx.hstack(
                                    rx.button(
                                        "Toggle",
                                        on_click=State.toggle_active(user.id),
                                        size="1",
                                    ),
                                    rx.button(
                                        "Delete",
                                        on_click=State.delete_user(user.id),
                                        color_scheme="tomato",
                                        size="1",
                                    ),
                                    spacing="2",
                                ),
                            ),
                        ),
                    ),
                ),
                variant="surface",
                width="100%",
            ),
            spacing="5",
            width="100%",
        ),
        max_width="900px",
        padding="2em",
        on_mount=State.load_users,
    )


app = rx.App()
app.add_page(index, route="/", title="User Management")