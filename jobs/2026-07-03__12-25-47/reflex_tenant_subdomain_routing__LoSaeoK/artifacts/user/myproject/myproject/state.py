"""State classes for the myproject application."""

import reflex as rx

from .models import Tenant


def _ensure_seed_tenants() -> None:
    """Insert the seed tenants if they don't exist."""
    seed = [
        ("acme", "Acme Corp"),
        ("globex", "Globex Inc"),
        ("initech", "Initech LLC"),
    ]
    with rx.session() as session:
        for slug, name in seed:
            existing = session.query(Tenant).filter(Tenant.slug == slug).first()
            if existing is None:
                session.add(Tenant(slug=slug, name=name))
        session.commit()


class TenantState(rx.State):
    """Base state for tenant pages - holds the resolved tenant info."""

    tenant_name: str = ""
    tenant_slug: str = ""
    found: bool = False

    @rx.event
    def load_tenant(self) -> None:
        """Load tenant info based on the dynamic route param."""
        # Make sure seed rows exist (idempotent).
        _ensure_seed_tenants()
        slug = self.router.page.params.get("tenant_id", "")
        with rx.session() as session:
            tenant = session.query(Tenant).filter(Tenant.slug == slug).first()
            if tenant is not None:
                self.tenant_slug = tenant.slug
                self.tenant_name = tenant.name
                self.found = True
            else:
                self.tenant_slug = ""
                self.tenant_name = ""
                self.found = False
