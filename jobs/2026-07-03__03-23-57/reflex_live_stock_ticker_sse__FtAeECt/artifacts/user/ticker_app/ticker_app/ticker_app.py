import reflex as rx
import asyncio
import random
from .engine import engine

class State(rx.State):
    prices: dict[str, float] = {
        "AAPL": 150.00,
        "GOOG": 2800.00,
        "MSFT": 300.00,
        "AMZN": 3300.00,
        "TSLA": 700.00,
    }
    seeds: dict[str, float] = {
        "AAPL": 150.00,
        "GOOG": 2800.00,
        "MSFT": 300.00,
        "AMZN": 3300.00,
        "TSLA": 700.00,
    }
    running: bool = False
    update_count: int = 0

    # Backend-only vars
    _loop_active: bool = False
    _should_run: bool = False

    @rx.var(cache=True)
    def percent_change(self) -> dict[str, float]:
        return {
            symbol: round((self.prices[symbol] - self.seeds[symbol]) / self.seeds[symbol] * 100.0, 4)
            for symbol in self.prices
        }

    @rx.event
    def on_load(self):
        if engine.running:
            self._should_run = True
            return State.ticker_loop

    @rx.event
    def start_ticker(self):
        self._should_run = True
        engine.driven_by_reflex = True
        engine.start()
        return State.ticker_loop

    @rx.event
    def stop_ticker(self):
        self._should_run = False
        engine.stop()

    @rx.event(background=True)
    async def ticker_loop(self):
        async with self:
            if self._loop_active:
                return
            self._loop_active = True
            self.running = True

        try:
            while True:
                async with self:
                    if not self._should_run or not engine.running:
                        break

                if not engine.driven_by_reflex:
                    # Mirror engine state
                    async with self:
                        self.prices = engine.prices.copy()
                        self.update_count = engine.update_count
                        self.running = engine.running
                else:
                    # Drive engine and state
                    async with self:
                        for symbol in self.prices:
                            current_price = self.prices[symbol]
                            change = current_price * random.uniform(-0.005, 0.005)
                            new_price = max(0.01, current_price + change)
                            self.prices[symbol] = new_price
                            engine.prices[symbol] = new_price
                        
                        self.update_count += 1
                        engine.update_count = self.update_count
                        
                        for symbol in self.prices:
                            seed_price = self.seeds[symbol]
                            engine.percent_changes[symbol] = round((self.prices[symbol] - seed_price) / seed_price * 100.0, 4)

                await asyncio.sleep(0.5)
        finally:
            async with self:
                self._loop_active = False
                self.running = False


def index() -> rx.Component:
    symbols = ["AAPL", "GOOG", "MSFT", "AMZN", "TSLA"]
    
    rows = [
        rx.table.row(
            rx.table.row_header_cell(symbol),
            rx.table.cell(State.prices[symbol].to_string()),
            rx.table.cell(State.percent_change[symbol].to_string() + "%"),
        )
        for symbol in symbols
    ]

    return rx.container(
        rx.vstack(
            rx.heading("Live Stock Ticker", size="8", margin_bottom="4"),
            
            rx.hstack(
                rx.button("Start", on_click=State.start_ticker, color_scheme="green"),
                rx.button("Stop", on_click=State.stop_ticker, color_scheme="red"),
                spacing="4",
                margin_bottom="4",
            ),
            
            rx.text(
                rx.cond(State.running, "Status: Running", "Status: Stopped"),
                size="4",
                weight="bold",
                margin_bottom="4",
            ),
            
            rx.table.root(
                rx.table.header(
                    rx.table.row(
                        rx.table.column_header_cell("Symbol"),
                        rx.table.column_header_cell("Price"),
                        rx.table.column_header_cell("Percent Change"),
                    ),
                ),
                rx.table.body(*rows),
                width="100%",
                variant="surface",
            ),
            
            spacing="2",
            align="center",
            padding="6",
        )
    )


from fastapi import FastAPI

fastapi_app = FastAPI()

@fastapi_app.post("/api/ticker/start")
async def start_ticker_api():
    already_running = engine.running
    started = engine.start()
    return {"running": True, "started": started}

@fastapi_app.post("/api/ticker/stop")
async def stop_ticker_api():
    engine.stop()
    return {"running": False}

@fastapi_app.get("/api/ticker/snapshot")
async def get_snapshot_api():
    return engine.snapshot()


app = rx.App(api_transformer=fastapi_app)
app.add_page(index, on_load=State.on_load)
