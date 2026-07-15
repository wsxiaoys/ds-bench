import secrets
import httpx
import jwt
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
import reflex as rx

# Generate a secure random secret at application startup
JWT_SECRET = secrets.token_urlsafe(32)
JWT_ALGORITHM = "HS256"

# FastAPI Sub-App
fastapi_app = FastAPI()

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    access_token: str

class MeResponse(BaseModel):
    user: str

@fastapi_app.post("/api/login", response_model=LoginResponse)
def login_endpoint(req: LoginRequest):
    if req.username == "admin" and req.password == "secret":
        token = jwt.encode({"sub": req.username}, JWT_SECRET, algorithm=JWT_ALGORITHM)
        return LoginResponse(access_token=token)
    raise HTTPException(status_code=401, detail="Invalid credentials")

@fastapi_app.get("/api/me", response_model=MeResponse)
def me_endpoint(REDACTED Header(None)):
    if not REDACTED(status_code=401, detail="Missing authorization header")
    
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid authorization header format")
    
    token = parts[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        username = payload.get("sub")
        if username != "admin":
            raise HTTPException(status_code=403, detail="Forbidden")
        return MeResponse(user=username)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


class State(rx.State):
    username_input: str = ""
    password_input: str = ""
    is_logged_in: bool = False
    _current_user: str = ""
    error_message: str = ""

    def set_username_input(self, val: str):
        self.username_input = val

    def set_password_input(self, val: str):
        self.password_input = val

    async def handle_login(self):
        self.error_message = ""
        self.is_logged_in = False
        self._current_user = ""

        async with httpx.AsyncClient() as client:
            try:
                # 1. POST /api/login
                response = await client.post(
                    "http://localhost:8000/api/login",
                    json={"username": self.username_input, "password": self.password_input}
                )
                if response.status_code != 200:
                    self.error_message = f"Login failed (status {response.status_code}): {response.text}"
                    return
                
                data = response.json()
                token = data.get("access_token")
                if not token:
                    self.error_message = "No access token in response"
                    return
                
                # 2. GET /api/me
                me_response = await client.get(
                    "http://localhost:8000/api/me",
                    headers={"Authorization": f"Bearer {token}"}
                )
                if me_response.status_code != 200:
                    self.error_message = f"Get me failed (status {me_response.status_code}): {me_response.text}"
                    return
                
                me_data = me_response.json()
                self._current_user = me_data.get("user", "")
                self.is_logged_in = True
            except Exception as e:
                self.error_message = f"Error during auth: {str(e)}"

    def handle_logout(self):
        self.is_logged_in = False
        self._current_user = ""
        self.username_input = ""
        self.password_input = ""
        self.error_message = ""


def index() -> rx.Component:
    return rx.container(
        rx.color_mode.button(position="top-right"),
        rx.vstack(
            rx.heading("Reflex FastAPI JWT Auth", size="8"),
            
            # Show login status (render the value of the frontend state var)
            rx.text(
                "Logged In: ",
                rx.cond(State.is_logged_in, "True", "False"),
                size="5",
                weight="bold",
                color=rx.cond(State.is_logged_in, "green", "red"),
            ),
            
            rx.cond(
                State.is_logged_in,
                # If logged in, show success and logout
                rx.vstack(
                    rx.text("Welcome, admin! (Authenticated successfully via JWT)", size="4"),
                    rx.button("Logout", on_click=State.handle_logout, color_scheme="red"),
                    spacing="3",
                    align="center",
                ),
                # If not logged in, show login form
                rx.vstack(
                    rx.input(
                        placeholder="Username",
                        value=State.username_input,
                        on_change=State.set_username_input,
                        width="300px",
                    ),
                    rx.input(
                        placeholder="Password",
                        type="password",
                        value=State.password_input,
                        on_change=State.set_password_input,
                        width="300px",
                    ),
                    rx.button("Login", on_click=State.handle_login, width="300px"),
                    spacing="3",
                    align="center",
                )
            ),
            
            # Error message display
            rx.cond(
                State.error_message != "",
                rx.text(State.error_message, color="red", size="3"),
            ),
            
            spacing="5",
            justify="center",
            align="center",
            min_height="80vh",
        ),
    )


app = rx.App(api_transformer=fastapi_app)
app.add_page(index)
