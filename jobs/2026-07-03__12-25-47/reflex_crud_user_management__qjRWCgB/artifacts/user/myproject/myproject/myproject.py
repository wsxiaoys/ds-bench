"""CRUD User Management with Reflex."""

import reflex as rx

from rxconfig import config


class User(rx.Model, table=True):
    """User model stored in the SQLite database."""

    username: str
    email: str
    is_active: bool = True


class State(rx.State):
    """The app state."""

    users: list[User] = []
    username: str = ""
    email: str = ""

    def set_username(self, value: str):
        """Set the username field."""
        self.username = value

    def set_email(self, value: str):
        """Set the email field."""
        self.email = value

    def load_users(self):
        """Load all users from the database."""
        with rx.session() as session:
            self.users = session.exec(User.select()).all()

    def create_user(self):
        """Create a new user."""
        with rx.session() as session:
            user = User(
                username=self.username,
                email=self.email,
                is_active=True,
            )
            session.add(user)
            session.commit()
            self.username = ""
            self.email = ""
        self.load_users()

    def delete_user(self, user_id: int):
        """Delete a user by id."""
        with rx.session() as session:
            user = session.get(User, user_id)
            if user is not None:
                session.delete(user)
                session.commit()
        self.load_users()

    def toggle_active(self, user_id: int):
        """Toggle the is_active flag of a user."""
        with rx.session() as session:
            user = session.get(User, user_id)
            if user is not None:
                user.is_active = not user.is_active
                session.add(user)
                session.commit()
        self.load_users()


def _user_row(user: User) -> rx.Component:
    return rx.table.row(
        rx.table.cell(user.username),
        rx.table.cell(user.email),
        rx.table.cell(rx.cond(user.is_active, rx.text("True"), rx.text("False"))),
        rx.table.cell(
            rx.hstack(
                rx.button(
                    "Toggle",
                    on_click=lambda: State.toggle_active(user.id),
                    size="2",
                ),
                rx.button(
                    "Delete",
                    on_click=lambda: State.delete_user(user.id),
                    size="2",
                    color_scheme="red",
                ),
                spacing="2",
            )
        ),
    )


def index() -> rx.Component:
    return rx.container(
        rx.color_mode.button(position="top-right"),
        rx.vstack(
            rx.heading("User Management", size="7"),
            rx.vstack(
                rx.heading("Create User", size="4"),
                rx.input(
                    placeholder="Username",
                    value=State.username,
                    on_change=State.set_username,
                ),
                rx.input(
                    placeholder="Email",
                    value=State.email,
                    on_change=State.set_email,
                ),
                rx.button("Create", on_click=State.create_user),
                spacing="2",
                align="stretch",
            ),
            rx.table.root(
                rx.table.header(
                    rx.table.row(
                        rx.table.column_header_cell("Username"),
                        rx.table.column_header_cell("Email"),
                        rx.table.column_header_cell("Active"),
                        rx.table.column_header_cell("Actions"),
                    ),
                ),
                rx.table.body(
                    rx.foreach(State.users, _user_row),
                ),
            ),
            spacing="5",
        ),
        on_mount=State.load_users,
    )


app = rx.App()
app.add_page(index)
