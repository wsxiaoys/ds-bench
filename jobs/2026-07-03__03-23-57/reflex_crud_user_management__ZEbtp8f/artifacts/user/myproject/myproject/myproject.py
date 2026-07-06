import reflex as rx

class User(rx.Model, table=True):
    username: str
    email: str
    is_active: bool = True

class State(rx.State):
    users: list[User] = []

    def load_users(self):
        with rx.session() as session:
            self.users = session.exec(User.select()).all()

    def create_user(self, form_data: dict):
        username = form_data.get("username", "").strip()
        email = form_data.get("email", "").strip()
        if not username or not email:
            return
        user = User(username=username, email=email, is_active=True)
        with rx.session() as session:
            session.add(user)
            session.commit()
        self.load_users()

    def delete_user(self, user_id: int):
        with rx.session() as session:
            user = session.exec(User.select().where(User.id == user_id)).first()
            if user:
                session.delete(user)
                session.commit()
        self.load_users()

    def toggle_active(self, user_id: int):
        with rx.session() as session:
            user = session.exec(User.select().where(User.id == user_id)).first()
            if user:
                user.is_active = not user.is_active
                session.add(user)
                session.commit()
        self.load_users()

def render_user_row(user: User):
    return rx.table.row(
        rx.table.cell(user.username),
        rx.table.cell(user.email),
        rx.table.cell(rx.cond(user.is_active, "Active", "Inactive")),
        rx.table.cell(
            rx.hstack(
                rx.button(
                    "Toggle",
                    on_click=State.toggle_active(user.id),
                    color_scheme="blue",
                    size="1",
                ),
                rx.button(
                    "Delete",
                    on_click=State.delete_user(user.id),
                    color_scheme="red",
                    size="1",
                ),
                spacing="2",
            )
        )
    )

def index() -> rx.Component:
    return rx.container(
        rx.vstack(
            rx.heading("User Management", size="8", margin_bottom="4"),
            
            # Form for creating a new user
            rx.card(
                rx.vstack(
                    rx.heading("Create New User", size="4"),
                    rx.form(
                        rx.vstack(
                            rx.input(
                                placeholder="Username",
                                name="username",
                                required=True,
                                width="100%",
                            ),
                            rx.input(
                                placeholder="Email",
                                name="email",
                                type="email",
                                required=True,
                                width="100%",
                            ),
                            rx.button("Create", type="submit", width="100%"),
                            spacing="3",
                        ),
                        on_submit=State.create_user,
                        reset_on_submit=True,
                        width="100%",
                    ),
                    spacing="3",
                    width="100%",
                ),
                width="100%",
                padding="4",
            ),
            
            # Table listing existing users
            rx.card(
                rx.vstack(
                    rx.heading("Existing Users", size="4"),
                    rx.table.root(
                        rx.table.header(
                            rx.table.row(
                                rx.table.column_header_cell("Username"),
                                rx.table.column_header_cell("Email"),
                                rx.table.column_header_cell("Status"),
                                rx.table.column_header_cell("Actions"),
                            )
                        ),
                        rx.table.body(
                            rx.foreach(
                                State.users,
                                render_user_row,
                            )
                        ),
                        width="100%",
                    ),
                    spacing="3",
                    width="100%",
                ),
                width="100%",
                padding="4",
            ),
            
            spacing="5",
            width="100%",
            max_width="600px",
            margin_x="REDACTED",
            padding_y="8",
        ),
        on_mount=State.load_users,
    )

app = rx.App()
app.add_page(index)
