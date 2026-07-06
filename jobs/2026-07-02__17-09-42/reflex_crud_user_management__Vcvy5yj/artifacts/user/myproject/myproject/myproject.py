"""Welcome to Reflex! This file outlines the steps to create a basic app."""

import reflex as rx

from rxconfig import config

from myproject.models import User


class State(rx.State):
    """The app state."""

    users: list[User] = []

    @rx.event
    def load_users(self) -> None:
        with rx.session() as session:
            self.users = session.query(User).all()

    @rx.event
    def create_user(self, form_data: dict) -> None:
        with rx.session() as session:
            user = User(
                username=form_data["username"],
                email=form_data["email"],
            )
            session.add(user)
            session.commit()
        self.load_users()

    @rx.event
    def delete_user(self, user_id: int) -> None:
        with rx.session() as session:
            user = session.query(User).filter(User.id == user_id).first()
            if user is not None:
                session.delete(user)
                session.commit()
        self.load_users()

    @rx.event
    def toggle_active(self, user_id: int) -> None:
        with rx.session() as session:
            user = session.query(User).filter(User.id == user_id).first()
            if user is not None:
                user.is_active = not user.is_active
                session.add(user)
                session.commit()
        self.load_users()


def _user_row(user: User) -> rx.Component:
    return rx.table.row(
        rx.table.cell(user.username),
        rx.table.cell(user.email),
        rx.table.cell(rx.cond(user.is_active, "Yes", "No")),
        rx.table.cell(
            rx.hstack(
                rx.button(
                    "Delete",
                    color_scheme="red",
                    on_click=lambda: State.delete_user(user.id),
                    size="2",
                ),
                rx.button(
                    "Toggle",
                    color_scheme="blue",
                    on_click=lambda: State.toggle_active(user.id),
                    size="2",
                ),
                spacing="2",
            )
        ),
    )


def index() -> rx.Component:
    return rx.container(
        rx.color_mode.button(position="top-right"),
        rx.vstack(
            rx.heading("User Management", size="8"),
            rx.form.root(
                rx.vstack(
                    rx.input(
                        name="username",
                        placeholder="Username",
                        required=True,
                    ),
                    rx.input(
                        name="email",
                        placeholder="Email",
                        type="email",
                        required=True,
                    ),
                    rx.button("Create", type="submit", color_scheme="green"),
                    spacing="2",
                    align="stretch",
                ),
                on_submit=State.create_user,
                reset_on_submit=True,
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
                width="100%",
            ),
            spacing="5",
            width="100%",
            max_width="900px",
            padding_y="5",
            on_mount=State.load_users,
        ),
    )


app = rx.App()
app.add_page(index)