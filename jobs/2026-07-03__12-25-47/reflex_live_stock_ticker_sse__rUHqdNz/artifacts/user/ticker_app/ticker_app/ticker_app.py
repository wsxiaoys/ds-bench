"""Reflex stock-ticker dashboard.

This module wires together:
- A `TickerState` that exposes the live price book to the browser.
- A long-running `@rx.event(background=True)` handler that mirrors the
  shared engine's ticks into the Reflex state every 500 ms.
- A `percent_change` cached computed var.
- A FastAPI sub-app (mounted via `api_transformer`) that exposes the
  headless REST surface used by the verifier.
"""

from __future__ import annotations

import asyncio
from typing import Any, Dict, List

import fastapi
import reflex as rx

from .engine import SEEDS, SYMBOLS, engine


def _row(symbol: str, price: float, percent: float) -> Dict[str, Any]:
    return {
        "symbol": symbol,
        "price_text": f"${price:,.2f}",
        "percent_text": f"{percent:+.4f}%",
        "percent": float(percent),
    }


# ----------------------------------------------------------------------- state
class TickerState(rx.State):
    """Live state for the stock-ticker page."""

    # Plain serializable base vars (visible to the UI).
    prices: Dict[str, float] = dict(SEEDS)
    seeds: Dict[str, float] = dict(SEEDS)
    running: bool = False
    update_count: int = 0

    # Backend-only vars (underscore-prefixed, not serialized to the client).
    _loop_active: bool = False

    # ---------------------------------------------------------------- computed
    @rx.var(cache=True)
    def percent_change(self) -> Dict[str, float]:
        """Per-symbol percent change vs. seed, rounded to 4 decimal places."""
        prices = self.prices
        seeds = self.seeds
        result: Dict[str, float] = {}
        for sym in SYMBOLS:
            seed = seeds.get(sym, SEEDS[sym])
            current = prices.get(sym, seed)
            if seed == 0:
                result[sym] = 0.0
            else:
                result[sym] = round((current - seed) / seed * 100.0, 4)
        return result

    @rx.var
    def rows(self) -> List[Dict[str, Any]]:
        """Pre-formatted table rows built from the live prices and computed var."""
        prices = self.prices
        seeds = self.seeds
        pct_map = self.percent_change
        out: List[Dict[str, Any]] = []
        for sym in SYMBOLS:
            price = float(prices.get(sym, seeds.get(sym, SEEDS[sym])))
            pct = float(pct_map.get(sym, 0.0))
            out.append(_row(sym, price, pct))
        return out

    # ---------------------------------------------------------------- helpers
    def _pull_snapshot_into_state(self) -> None:
        """Copy the engine's current snapshot into the (non-background) base vars."""
        snap = engine.snapshot()
        self.prices = snap["prices"]
        self.seeds = snap["seeds"]
        self.running = bool(snap["running"])
        self.update_count = int(snap["update_count"])

    # ---------------------------------------------------------------- handlers
    @rx.event
    async def start(self) -> Any:
        """UI Start handler. Drives the engine idempotently and kicks off the
        background event handler that mirrors ticks into State."""
        async with self:
            if self._loop_active:
                self._pull_snapshot_into_state()
                return
            self._loop_active = True

        # Ask the engine to start (it is itself idempotent).
        await engine.start()

        async with self:
            self._pull_snapshot_into_state()

        # Kick off the background mirror. The background handler itself
        # owns the idempotency guard around _loop_active.
        return TickerState.background_update

    @rx.event
    async def stop(self) -> None:
        """UI Stop handler."""
        await engine.stop()
        async with self:
            self._loop_active = False
            self._pull_snapshot_into_state()

    @rx.event(background=True)
    async def background_update(self) -> None:
        """Long-running background handler that mirrors the engine's ticks
        into the Reflex State. Owns the idempotency guard `_loop_active`.
        """
        async with self:
            if self._loop_active:
                return
            self._loop_active = True

        try:
            while True:
                await asyncio.sleep(engine.TICK_SECONDS)
                snap = engine.snapshot()
                async with self:
                    self.prices = snap["prices"]
                    self.update_count = int(snap["update_count"])
                    self.running = bool(snap["running"])
                if not snap["running"]:
                    break
        finally:
            async with self:
                self._loop_active = False


# ----------------------------------------------------------------------- UI
def _render_row(row: Dict[str, Any]) -> rx.Component:
    return rx.table.row(
        rx.table.cell(rx.text(row["symbol"], weight="bold")),
        rx.table.cell(rx.text(row["price_text"])),
        rx.table.cell(rx.text(row["percent_text"])),
    )


def index() -> rx.Component:
    return rx.container(
        rx.vstack(
            rx.heading("Live Stock Ticker", size="7"),
            rx.text(
                rx.cond(
                    TickerState.running,
                    rx.text("Status: RUNNING", color="green", weight="bold"),
                    rx.text("Status: STOPPED", color="red", weight="bold"),
                )
            ),
            rx.hstack(
                rx.button("Start", on_click=TickerState.start, color_scheme="green"),
                rx.button("Stop", on_click=TickerState.stop, color_scheme="red"),
                spacing="4",
            ),
            rx.table.root(
                rx.table.header(
                    rx.table.row(
                        rx.table.column_header_cell("Symbol"),
                        rx.table.column_header_cell("Price"),
                        rx.table.column_header_cell("Percent Change"),
                    )
                ),
                rx.table.body(
                    rx.foreach(TickerState.rows, _render_row),
                ),
                width="100%",
            ),
            spacing="4",
            padding="2em",
        )
    )


# ----------------------------------------------------------------------- API
api_app = fastapi.FastAPI(title="Ticker REST API")


@api_app.post("/api/ticker/start")
async def api_start() -> Dict[str, Any]:
    started = await engine.start()
    return {"running": bool(engine.running), "started": bool(started)}


@api_app.post("/api/ticker/stop")
async def api_stop() -> Dict[str, Any]:
    await engine.stop()
    return {"running": bool(engine.running)}


@api_app.get("/api/ticker/snapshot")
async def api_snapshot() -> Dict[str, Any]:
    return engine.snapshot()


# ----------------------------------------------------------------------- app
app = rx.App(api_transformer=api_app)
app.add_page(index)
