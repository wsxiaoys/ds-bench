import reflex as rx
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import JSONResponse
from starlette.types import ASGIApp, Scope, Receive, Send
from contextlib import asynccontextmanager
from sqlmodel import Field, select

# 1. Tenant Model
class Tenant(rx.Model, table=True):
    slug: str = Field(unique=True, index=True)
    name: str

# 2. State definition
class TenantState(rx.State):
    tenant_name: str = ""
    tenant_found: bool = False

    def load_tenant(self):
        t_id = self.tenant_id
        
        # Fallback parsing of route if tenant_id is empty
        if not t_id:
            parts = self.router.url.path.strip("/").split("/")
            if len(parts) >= 2 and parts[0] == "t":
                t_id = parts[1]
                
        print(f"Loading tenant: {t_id}")
        
        with rx.session() as session:
            tenant = session.exec(select(Tenant).where(Tenant.slug == t_id)).first()
            if tenant:
                self.tenant_name = tenant.name
                self.tenant_found = True
            else:
                self.tenant_name = ""
                self.tenant_found = False

# 3. Pages
def dashboard() -> rx.Component:
    return rx.container(
        rx.cond(
            TenantState.tenant_found,
            rx.vstack(
                rx.heading(TenantState.tenant_name),
                rx.text("Dashboard"),
            ),
            rx.vstack(
                rx.heading("Tenant Not Found"),
            )
        )
    )

def settings() -> rx.Component:
    return rx.container(
        rx.cond(
            TenantState.tenant_found,
            rx.vstack(
                rx.heading(TenantState.tenant_name),
                rx.text("Settings"),
            ),
            rx.vstack(
                rx.heading("Tenant Not Found"),
            )
        )
    )

def index() -> rx.Component:
    return rx.container(
        rx.vstack(
            rx.heading("Multi-Tenant App"),
            rx.text("Welcome to the multi-tenant routing application."),
        )
    )

# 4. FastAPI Setup & Seeding
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Seeding
    with rx.session() as session:
        for slug, name in [
            ("acme", "Acme Corp"),
            ("globex", "Globex Inc"),
            ("initech", "Initech LLC"),
        ]:
            existing = session.exec(select(Tenant).where(Tenant.slug == slug)).first()
            if not existing:
                session.add(Tenant(slug=slug, name=name))
        session.commit()
    yield

fastapi_app = FastAPI(lifespan=lifespan)

# 5. ASGI Middleware
class TenantASGIMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] == "http":
            path = scope.get("path", "")
            if path.startswith("/api/"):
                headers = dict(scope.get("headers", []))
                tenant_id_bytes = headers.get(b"x-tenant-id")
                if not tenant_id_bytes:
                    response = JSONResponse(status_code=403, content={"detail": "forbidden"})
                    await response(scope, receive, send)
                    return
                
                tenant_slug = tenant_id_bytes.decode("utf-8")
                with rx.session() as session:
                    tenant = session.exec(select(Tenant).where(Tenant.slug == tenant_slug)).first()
                    if not tenant:
                        response = JSONResponse(status_code=403, content={"detail": "forbidden"})
                        await response(scope, receive, send)
                        return
                        
        await self.app(scope, receive, send)

fastapi_app.add_middleware(TenantASGIMiddleware)

# 6. FastAPI Endpoint
@fastapi_app.get("/api/me")
def get_me(x_tenant_id: str = Header(...)):
    with rx.session() as session:
        tenant = session.exec(select(Tenant).where(Tenant.slug == x_tenant_id)).first()
        if not tenant:
            raise HTTPException(status_code=403, detail="forbidden")
        return {"slug": tenant.slug, "name": tenant.name}

# 7. App Initialization
app = rx.App(api_transformer=fastapi_app)
app.add_page(index)
app.add_page(dashboard, route="/t/[tenant_id]/dashboard", on_load=TenantState.load_tenant)
app.add_page(settings, route="/t/[tenant_id]/settings", on_load=TenantState.load_tenant)
