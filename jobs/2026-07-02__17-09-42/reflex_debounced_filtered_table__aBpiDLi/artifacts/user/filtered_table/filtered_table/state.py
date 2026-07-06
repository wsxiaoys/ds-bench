"""Reactive State for the filterable products table."""

from __future__ import annotations

from typing import Optional

import reflex as rx

from .models import Product, CATEGORIES
from .query import build_filter_query


class State(rx.State):
    """State for the filtered-table page."""

    # ---- Filter / sort synchronized base vars -----------------------------
    search: str = ""
    category: str = "All"
    min_price: str = ""   # kept as strings so we can clear them in the UI
    max_price: str = ""
    in_stock_only: bool = False
    sort_by: str = "id"
    sort_dir: str = "asc"

    # ---- Output vars -------------------------------------------------------
    result_count: int = 0
    filtered: list[Product] = []

    # ---- Constants exposed for the UI --------------------------------------
    category_options: list[str] = ["All", *CATEGORIES]
    sort_by_options: list[str] = ["id", "name", "price", "category"]
    sort_dir_options: list[str] = ["asc", "desc"]

    # ---- Lifecycle hooks ---------------------------------------------------

    async def on_load(self) -> None:
        """Run once when the page is loaded: seed if needed, then filter."""
        # Imported lazily to avoid a circular import at module load time.
        from .models import seed_products

        seed_products()
        await self.recompute_filter()

    # ---- Event handlers ----------------------------------------------------

    def set_search(self, value: str) -> None:
        self.search = value
        return State.recompute_filter  # type: ignore[return-value]

    def set_category(self, value: str) -> None:
        self.category = value
        return State.recompute_filter  # type: ignore[return-value]

    def set_min_price(self, value: str) -> None:
        self.min_price = value
        return State.recompute_filter  # type: ignore[return-value]

    def set_max_price(self, value: str) -> None:
        self.max_price = value
        return State.recompute_filter  # type: ignore[return-value]

    def set_in_stock_only(self, value: bool) -> None:
        self.in_stock_only = value
        return State.recompute_filter  # type: ignore[return-value]

    def set_sort_by(self, value: str) -> None:
        self.sort_by = value
        return State.recompute_filter  # type: ignore[return-value]

    def set_sort_dir(self, value: str) -> None:
        self.sort_dir = value
        return State.recompute_filter  # type: ignore[return-value]

    @staticmethod
    def _coerce_float(value: str) -> Optional[float]:
        if value is None:
            return None
        text = str(value).strip()
        if text == "":
            return None
        try:
            return float(text)
        except (TypeError, ValueError):
            return None

    @rx.event(background=True)
    async def recompute_filter(self) -> None:
        """Recompute ``filtered`` and ``result_count`` from the current filters.

        Runs as an async background event. The heavy SQL work happens outside
        the state lock; state mutation happens inside ``async with self:``.
        """

        # Snapshot inputs first to avoid racing with other handlers.
        search = self.search
        category = self.category
        min_price_text = self.min_price
        max_price_text = self.max_price
        in_stock_only = self.in_stock_only
        sort_by = self.sort_by
        sort_dir = self.sort_dir

        statement = build_filter_query(
            search=search,
            category=category,
            min_price=State._coerce_float(min_price_text),
            max_price=State._coerce_float(max_price_text),
            in_stock_only=in_stock_only,
            sort_by=sort_by,
            sort_dir=sort_dir,
        )

        async with rx.asession() as session:
            result = await session.exec(statement)
            rows = list(result.all())

        async with self:
            self.filtered = rows
            self.result_count = len(rows)