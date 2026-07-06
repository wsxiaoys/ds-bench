"""In-memory price-book engine shared between Reflex State and REST API.

The engine owns:
- The deterministic seed prices for the symbol universe.
- The current prices for each symbol.
- A counter of completed 500 ms ticks since the most recent start.
- A running flag.

The Reflex UI Start/Stop event handlers and the FastAPI endpoints both call
into this single engine, so the state observed by the REST surface and the
state observed by the browser are guaranteed to agree.
"""

from __future__ import annotations

import asyncio
import random
from typing import Awaitable, Callable, Dict, Optional


SEEDS: Dict[str, float] = {
    "AAPL": 150.00,
    "GOOG": 2800.00,
    "MSFT": 300.00,
    "AMZN": 3300.00,
    "TSLA": 700.00,
}

SYMBOLS = tuple(SEEDS.keys())


class TickerEngine:
    """A tiny in-memory ticker engine with an asyncio background task."""

    TICK_SECONDS = 0.5
    MAX_DELTA_FRACTION = 0.005  # +/- 0.5% per tick
    MIN_PRICE = 0.01

    def __init__(self) -> None:
        self._prices: Dict[str, float] = dict(SEEDS)
        self._seeds: Dict[str, float] = dict(SEEDS)
        self._running: bool = False
        self._update_count: int = 0
        self._task: Optional[asyncio.Task] = None
        self._lock = asyncio.Lock()
        # Fixed seed so the executor's randomness is deterministic.
        self._rng = random.Random(20240101)
        # Optional listener (used by the Reflex UI to mirror ticks into State).
        self._listener: Optional[Callable[[Dict[str, float], int], Awaitable[None] | None]] = None

    # ------------------------------------------------------------------ access
    def set_listener(
        self,
        listener: Optional[Callable[[Dict[str, float], int], Awaitable[None] | None]],
    ) -> None:
        """Register a coroutine to receive a copy of every tick."""
        self._listener = listener

    @property
    def seeds(self) -> Dict[str, float]:
        return dict(self._seeds)

    @property
    def running(self) -> bool:
        return self._running

    @property
    def update_count(self) -> int:
        return self._update_count

    def snapshot(self) -> Dict[str, object]:
        """Return a JSON-serializable view of the current engine state."""
        prices = {sym: float(self._prices[sym]) for sym in SYMBOLS}
        seeds = {sym: float(self._seeds[sym]) for sym in SYMBOLS}
        percent_changes = {
            sym: round((prices[sym] - seeds[sym]) / seeds[sym] * 100.0, 4)
            for sym in SYMBOLS
        }
        return {
            "running": bool(self._running),
            "update_count": int(self._update_count),
            "seeds": seeds,
            "prices": prices,
            "percent_changes": percent_changes,
        }

    # ---------------------------------------------------------------- mutation
    def reset_prices(self) -> None:
        """Reset prices back to seeds and zero the update count."""
        self._prices = dict(self._seeds)
        self._update_count = 0

    def tick_once(self) -> Dict[str, float]:
        import sys; print(f"TICK {self._update_count + 1}", file=sys.stderr, flush=True)
        """Apply one bounded random walk step and return the new prices."""
        for sym in SYMBOLS:
            current = self._prices[sym]
            delta_pct = self._rng.uniform(-self.MAX_DELTA_FRACTION, self.MAX_DELTA_FRACTION)
            new_price = current * (1.0 + delta_pct)
            if new_price < self.MIN_PRICE:
                new_price = self.MIN_PRICE
            self._prices[sym] = float(new_price)
        self._update_count += 1
        return dict(self._prices)

    # ---------------------------------------------------------------- control
    async def start(self) -> bool:
        """Start the background loop idempotently. Returns True if a new loop was started."""
        async with self._lock:
            if self._running and self._task is not None and not self._task.done():
                return False
            self._running = True
            self.reset_prices()
            self._task = asyncio.create_task(self._run())
            return True

    async def stop(self) -> None:
        """Stop the background loop if running."""
        async with self._lock:
            self._running = False
            task = self._task
            self._task = None
        if task is not None and not task.done():
            task.cancel()
            try:
                await task
            except (asyncio.CancelledError, Exception):
                pass

    async def _run(self) -> None:
        """The long-running tick loop."""
        try:
            while True:
                await asyncio.sleep(self.TICK_SECONDS)
                prices = self.tick_once()
                if self._listener is not None:
                    try:
                        result = self._listener(dict(prices), int(self._update_count))
                        if asyncio.iscoroutine(result):
                            await result
                    except Exception:
                        # Listener errors must not kill the engine loop.
                        pass
        except asyncio.CancelledError:
            return


# Module-level singleton used by both the Reflex State and the REST API.
engine = TickerEngine()
