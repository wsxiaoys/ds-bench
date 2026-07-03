"""Welcome to Reflex! This file outlines the steps to create a basic app."""

import reflex as rx
from typing import Optional

from .models import Product
from .queries import get_filtered_products_query
from .seed import seed_db
from .api import fastapi_app


class State(rx.State):
    """The app state."""
    search: str = ""
    category: str = "All"
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    in_stock_only: bool = False
    sort_by: str = "id"
    sort_dir: str = "asc"
    
    filtered: list[Product] = []
    result_count: int = 0

    @rx.var
    def min_price_str(self) -> str:
        return "" if self.min_price is None else str(self.min_price)

    @rx.var
    def max_price_str(self) -> str:
        return "" if self.max_price is None else str(self.max_price)

    @rx.event
    def on_load(self):
        seed_db()
        return State.filter_products

    @rx.event(background=True)
    async def filter_products(self):
        async with self:
            search = self.search
            category = self.category
            min_price = self.min_price
            max_price = self.max_price
            in_stock_only = self.in_stock_only
            sort_by = self.sort_by
            sort_dir = self.sort_dir
            
        async with rx.asession() as session:
            query = get_filtered_products_query(
                search=search,
                category=category,
                min_price=min_price,
                max_price=max_price,
                in_stock_only=in_stock_only,
                sort_by=sort_by,
                sort_dir=sort_dir
            )
            results = (await session.exec(query)).all()
            result_count = len(results)
            
        async with self:
            self.filtered = results
            self.result_count = result_count

    @rx.event
    def set_search(self, val: str):
        self.search = val
        return State.filter_products

    @rx.event
    def set_category(self, val: str):
        self.category = val
        return State.filter_products

    @rx.event
    def set_min_price(self, val: str):
        if val == "":
            self.min_price = None
        else:
            try:
                self.min_price = float(val)
            except ValueError:
                self.min_price = None
        return State.filter_products

    @rx.event
    def set_max_price(self, val: str):
        if val == "":
            self.max_price = None
        else:
            try:
                self.max_price = float(val)
            except ValueError:
                self.max_price = None
        return State.filter_products

    @rx.event
    def set_in_stock_only(self, val: bool):
        self.in_stock_only = val
        return State.filter_products

    @rx.event
    def set_sort_by(self, val: str):
        self.sort_by = val
        return State.filter_products

    @rx.event
    def set_sort_dir(self, val: str):
        self.sort_dir = val
        return State.filter_products


def index() -> rx.Component:
    return rx.container(
        rx.vstack(
            rx.heading("Debounced Multi-Filter Data Table", size="8", margin_bottom="4"),
            
            # Filter Controls Panel
            rx.card(
                rx.vstack(
                    rx.heading("Filter & Sort Options", size="4"),
                    rx.grid(
                        # Search
                        rx.vstack(
                            rx.text("Search Name", size="2", weight="bold"),
                            rx.debounce_input(
                                rx.input(
                                    placeholder="Search...",
                                    value=State.search,
                                    on_change=State.set_search,
                                    width="100%",
                                ),
                                debounce_timeout=300,
                            ),
                            width="100%",
                        ),
                        # Category
                        rx.vstack(
                            rx.text("Category", size="2", weight="bold"),
                            rx.select(
                                ["All", "Electronics", "Books", "Clothing", "Home", "Toys", "Sports"],
                                value=State.category,
                                on_change=State.set_category,
                                width="100%",
                            ),
                            width="100%",
                        ),
                        # Min Price
                        rx.vstack(
                            rx.text("Min Price", size="2", weight="bold"),
                            rx.input(
                                type="number",
                                placeholder="Min Price",
                                value=State.min_price_str,
                                on_change=State.set_min_price,
                                width="100%",
                            ),
                            width="100%",
                        ),
                        # Max Price
                        rx.vstack(
                            rx.text("Max Price", size="2", weight="bold"),
                            rx.input(
                                type="number",
                                placeholder="Max Price",
                                value=State.max_price_str,
                                on_change=State.set_max_price,
                                width="100%",
                            ),
                            width="100%",
                        ),
                        # Sort By
                        rx.vstack(
                            rx.text("Sort By", size="2", weight="bold"),
                            rx.select(
                                ["id", "name", "price", "category"],
                                value=State.sort_by,
                                on_change=State.set_sort_by,
                                width="100%",
                            ),
                            width="100%",
                        ),
                        # Sort Dir
                        rx.vstack(
                            rx.text("Sort Direction", size="2", weight="bold"),
                            rx.select(
                                ["asc", "desc"],
                                value=State.sort_dir,
                                on_change=State.set_sort_dir,
                                width="100%",
                            ),
                            width="100%",
                        ),
                        columns="3",
                        spacing="4",
                        width="100%",
                    ),
                    
                    # In Stock Checkbox
                    rx.hstack(
                        rx.checkbox(
                            checked=State.in_stock_only,
                            on_change=State.set_in_stock_only,
                            id="in_stock_only_cb",
                        ),
                        rx.text("In stock only", as_="label", html_for="in_stock_only_cb", size="2"),
                        spacing="2",
                        align="center",
                        margin_top="2",
                    ),
                    spacing="3",
                    width="100%",
                ),
                width="100%",
                padding="4",
                margin_bottom="4",
            ),
            
            # Result Count
            rx.hstack(
                rx.text("Result Count: ", weight="bold"),
                rx.text(State.result_count.to(str)),
                spacing="1",
                margin_bottom="2",
            ),
            
            # Data Table
            rx.table.root(
                rx.table.header(
                    rx.table.row(
                        rx.table.column_header_cell("ID"),
                        rx.table.column_header_cell("Name"),
                        rx.table.column_header_cell("Category"),
                        rx.table.column_header_cell("SKU"),
                        rx.table.column_header_cell("Price"),
                        rx.table.column_header_cell("In Stock"),
                    )
                ),
                rx.table.body(
                    rx.foreach(
                        State.filtered,
                        lambda item: rx.table.row(
                            rx.table.cell(item.id.to(str)),
                            rx.table.cell(item.name),
                            rx.table.cell(item.category),
                            rx.table.cell(item.sku),
                            rx.table.cell("$" + item.price.to(str)),
                            rx.table.cell(rx.cond(item.in_stock, "Yes", "No")),
                        )
                    )
                ),
                width="100%",
                variant="surface",
            ),
            spacing="4",
            width="100%",
            align_items="stretch",
        ),
        padding="4",
        size="3",
    )


app = rx.App(api_transformer=fastapi_app)
app.add_page(index, on_load=State.on_load)
