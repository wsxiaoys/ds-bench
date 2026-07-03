"""Shared in-memory price-book engine.

This module owns the canonical state that BOTH the Reflex UI event handlers
and the FastAPI REST endpoints read from / write to. Keeping the storage in
a plain module (under an ``asyncio.Lock``) lets us drive the ticker from
either surface area without coupling them to the Reflex ``State``.

Public surface:
    * ``SYMBOLS`` / ``SEEDS``         canonical universe + initial prices
    * ``start()``                    idempotently begin the update loop
    * ``stop()``                     cancel any running update loop
    * ``tick_once()``                mutate prices + count under the lock
    * ``snapshot()``                 thread-safe view of the current state
    * ``reset()``                    restore initial state (for testing)
"""

from __future__ import annotations

import asyncio
import random
from typing import Any

# ---------------------------------------------------------------------------
# Canonical universe
# ---------------------------------------------------------------------------

SYMBOLS: list[str] = ["AAPL", "GOOG", "MSFT", "AMZN", "TSLA"]

SEEDS: dict[str, float] = {
    "AAPL": 150.00,
    "GOOG": 2800.00,
    "MSFT": 300.00,
    "AMZN": 3300.00,
    "TSLA": 700.00,
}

TICK_INTERVAL_SECONDS: float = 0.5
MAX_WALK_FRACTION: float = 0.005  # +/- 0.5% per tick

# Deterministic seed so the random walk is reproducible across runs.
_RANDOM_SEED: int = 20251115


# ---------------------------------------------------------------------------
# Module-level state (the "engine")
# ---------------------------------------------------------------------------


def _initial_prices() -> dict[str, float]:
    return dict(SEEDS)


class _EngineState:
    """Container for the mutable engine state.

    A small class keeps the state tidy. All mutation goes through the
    ``asyncio.Lock`` so that ``tick_once`` + ``snapshot`` never tear and so
    that concurrent ``start`` / ``stop`` calls cannot race.
    """

    def __init__(self) -> None:
        self.lock: asyncio.Lock = asyncio.Lock()
        self.rng: random.Random = random.Random(_RANDOM_SEED)
        self.prices: dict[str, float] = _initial_prices()
        self.update_count: int = 0
        self.running: bool = False
        self._task: asyncio.Task[None] | None = None


_state = _EngineState()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _new_rng() -> random.Random:
    """Return a fresh deterministic RNG.

    The walk is reproducible across runs because we always seed with the
    same constant. A fresh RNG per ``start`` keeps the next-tick deltas
    predictable when the loop is restarted.
    """
    return random.Random(_RANDOM_SEED)


def _percent_change(prices: dict[str, float], seeds: dict[str, float]) -> dict[str, float]:
    out: dict[str, float] = {}
    for sym in SYMBOLS:
        seed = seeds[sym]
        current = prices[sym]
        pct = (current - seed) / seed * 100.0
        out[sym] = round(pct, 4)
    return out


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def tick_once() -> dict[str, float]:
    """Advance prices by one bounded random walk step.

    The mutation happens under the engine lock so that the snapshot reads a
    consistent view. Returns the freshly mutated ``prices`` mapping.
    """
    async with _state.lock:
        new_prices: dict[str, float] = {}
        for sym in SYMBOLS:
            current = _state.prices[sym]
            delta = current * _state.rng.uniform(-MAX_WALK_FRACTION, MAX_WALK_FRACTION)
            updated = current + delta
            # Clamp to strictly positive so prices never collapse to zero.
            if updated <= 0:
                updated = current * 0.5
                if updated <= 0:
                    updated = SEEDS[sym] * 0.01
            new_prices[sym] = updated
        _state.prices = new_prices
        _state.update_count += 1
        return dict(_state.prices)


async def snapshot() -> dict[str, Any]:
    """Return a JSON-serialisable view of the engine.

    Response shape::

        {
            "running":          bool,
            "update_count":     int,
            "seeds":            {symbol: float, ...},
            "prices":           {symbol: float, ...},
            "percent_changes":  {symbol: float, ...},
        }
    """
    async with _state.lock:
        prices = dict(_state.prices)
        seeds = dict(SEEDS)
        count = _state.update_count
        running = _state.running
    return {
        "running": running,
        "update_count": count,
        "seeds": seeds,
        "prices": prices,
        "percent_changes": _percent_change(prices, seeds),
    }


async def start() -> tuple[bool, bool]:
    """Idempotently start the internal update loop.

    Returns ``(running, started)`` where ``running`` reflects the loop
    state AFTER the call and ``started`` is ``True`` only if THIS call
    actually spun up a new loop (i.e. none was active beforehand).
    """
    async with _state.lock:
        task = _state._task
        if task is not None and not task.done():
            # Already running: idempotent — report running=True, started=False.
            _state.running = True
            return True, False

        # Fresh loop: reset count + RNG so multiple sessions behave predictably.
        _state.prices = _initial_prices()
        _state.update_count = 0
        _state.rng = _new_rng()
        _state.running = True
        _state._task = asyncio.create_task(
            _engine_loop(),
            name="ticker-engine-loop",
        )
        return True, True


async def stop() -> bool:
    """Cancel any running loop. Returns the running flag AFTER cancellation."""
    async with _state.lock:
        task = _state._task
        if task is not None and not task.done():
            task.cancel()
        _state.running = False
        _state._task = None
        return False


async def is_running() -> bool:
    async with _state.lock:
        return _state.running


def reset() -> None:
    """Synchronous hard-reset for test fixtures (not used by the REST API)."""
    if _state._task is not None and not _state._task.done():
        _state._task.cancel()
    _state.prices = _initial_prices()
    _state.update_count = 0
    _state.rng = random.Random(_RANDOM_SEED)
    _state.running = False
    _state._task = None


# ---------------------------------------------------------------------------
# Internal loop body
# ---------------------------------------------------------------------------


async def _engine_loop() -> None:
    """Body of the engine's own asyncio task.

    Started by ``start()`` when invoked via the REST surface. The Reflex
    background event handler is a separate driver but also funnels mutations
    through ``tick_once()`` so both surfaces stay consistent.
    """
    try:
        while True:
            await tick_once()
            await asyncio.sleep(TICK_INTERVAL_SECONDS)
    except asyncio.CancelledError:
        # Normal shutdown path.
        raise
    except Exception:
        # Loop crashed: clear running flag so the next start can spin a
        # fresh task up.
        async with _state.lock:
            _state.running = False
            _state._task = None
        raise
    finally:
        async with _state.lock:
            if _state._task is not None and _state._task.done():
                _state.running = False
                _state._task = None
