"""Top-level UI for the filtered_table app."""

from __future__ import annotations

import reflex as rx

from .api import build_api_app
from .models import CATEGORIES, Product
from .state import State


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _row(row: Product) -> rx.Component:
    """Render a single product row in the table."""
    return rx.table.row(
        rx.table.cell(row["id"]),
        rx.table.cell(row["name"]),
        rx.table.cell(row["category"]),
        rx.table.cell(row["price"].to_string()),
        rx.table.cell(rx.cond(row["in_stock"], "Yes", "No")),
    )


# ---------------------------------------------------------------------------
# Page
# ---------------------------------------------------------------------------


def _search_input() -> rx.Component:
    return rx.debounce_input(
        rx.input(
            placeholder="Search by name...",
            value=State.search,
            on_change=State.set_search,
            width="100%",
        ),
        debounce_timeout=300,
    )


def _category_select() -> rx.Component:
    return rx.select(
        ["All", *CATEGORIES],
        value=State.category,
        on_change=State.set_category,
    )


def _sort_by_select() -> rx.Component:
    return rx.select(
        ["id", "name", "price", "category"],
        value=State.sort_by,
        on_change=State.set_sort_by,
    )


def _sort_dir_select() -> rx.Component:
    return rx.select(
        ["asc", "desc"],
        value=State.sort_dir,
        on_change=State.set_sort_dir,
    )


def index() -> rx.Component:
    return rx.container(
        rx.color_mode.button(position="top-right"),
        rx.vstack(
            rx.heading("Filtered Products", size="8"),
            rx.text("Browse the catalog of 240 seeded products."),
            rx.box(
                rx.vstack(
                    rx.hstack(
                        rx.text("Search", min_width="6em"),
                        _search_input(),
                        width="100%",
                        align="center",
                    ),
                    rx.hstack(
                        rx.text("Category", min_width="6em"),
                        _category_select(),
                        rx.spacer(),
                        rx.text("In stock only"),
                        rx.checkbox(
                            is_checked=State.in_stock_only,
                            on_change=State.set_in_stock_only,
                        ),
                        width="100%",
                        align="center",
                    ),
                    rx.hstack(
                        rx.text("Min price", min_width="6em"),
                        rx.input(
                            type="number",
                            placeholder="(none)",
                            value=State.min_price,
                            on_change=State.set_min_price,
                        ),
                        rx.text("Max price", min_width="6em"),
                        rx.input(
                            type="number",
                            placeholder="(none)",
                            value=State.max_price,
                            on_change=State.set_max_price,
                        ),
                        width="100%",
                        align="center",
                    ),
                    rx.hstack(
                        rx.text("Sort by", min_width="6em"),
                        _sort_by_select(),
                        rx.text("Direction", min_width="6em"),
                        _sort_dir_select(),
                        width="100%",
                        align="center",
                    ),
                    spacing="3",
                    width="100%",
                ),
                padding="1em",
                border="1px solid var(--accent-3)",
                border_radius="8px",
                width="100%",
            ),
            rx.text(
                f"Results: ",
                rx.code(State.result_count.to_string()),
                font_size="md",
            ),
            rx.box(
                rx.table.root(
                    rx.table.header(
                        rx.table.row(
                            rx.table.column_header_cell("ID"),
                            rx.table.column_header_cell("Name"),
                            rx.table.column_header_cell("Category"),
                            rx.table.column_header_cell("Price"),
                            rx.table.column_header_cell("In stock"),
                        ),
                    ),
                    rx.table.body(
                        rx.foreach(State.filtered, _row),
                    ),
                    variant="surface",
                    size="3",
                    width="100%",
                ),
                width="100%",
            ),
            spacing="5",
            width="100%",
            padding_y="2em",
        ),
    )


# ---------------------------------------------------------------------------
# App + API transformer
# ---------------------------------------------------------------------------

api_app = build_api_app()

app = rx.App(api_transformer=api_app)
app.add_page(index, route="/", on_load=State.on_load)