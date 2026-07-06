"""Per-user fraud-detection state machine.

This module contains the pure state-transition logic that is driven by
Bytewax's :func:`bytewax.operators.stateful_map`.  The logic is kept
framework-agnostic so that it can be unit-tested in isolation.

States
------
A user can be in one of three logical states:

``LOGGED_OUT``
    The initial state.  No session is active and large transactions are
    ignored.  Represented by ``None`` so that Bytewax discards the state
    from its store (the default starting state is always ``None``).

``LOGGED_IN``
    A session is active following a ``login`` event.  No large
    transactions have been observed yet.

``SUSPICIOUS``
    At least one large transaction (``amount >= 1000``) has been
    observed within the login window.

Rules
-----
* ``login``        -> ``LOGGED_IN`` (records the login timestamp).
* ``transaction``  with ``amount >= 1000`` while ``LOGGED_IN`` or
  ``SUSPICIOUS`` and within 300s of the login increments the large-tx
  counter and transitions to ``SUSPICIOUS``.
* Reaching 3 large transactions within the window emits a
  ``FRAUD_ALERT`` and resets the user to ``LOGGED_OUT``.
* ``transaction`` more than 300s after the login resets the user to
  ``LOGGED_OUT`` (the current transaction is ignored).
* ``logout``       -> ``LOGGED_OUT`` immediately.
"""

from __future__ import annotations

import enum
from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple

# ---------------------------------------------------------------------------
# Configuration constants
# ---------------------------------------------------------------------------

#: Minimum transaction amount considered "large".
LARGE_TX_THRESHOLD: float = 1000

#: Number of large transactions within the login window that trigger fraud.
FRAUD_TX_COUNT: int = 3

#: How long (in seconds) after a login the window stays open.
LOGIN_WINDOW_SECONDS: int = 300

#: Marker written to the output stream when fraud is detected.
FRAUD_ALERT: str = "FRAUD_ALERT"


# ---------------------------------------------------------------------------
# State representation
# ---------------------------------------------------------------------------


class State(enum.Enum):
    """Logical states a user can occupy."""

    LOGGED_OUT = "LOGGED_OUT"
    LOGGED_IN = "LOGGED_IN"
    SUSPICIOUS = "SUSPICIOUS"


@dataclass(frozen=True)
class UserState:
    """Immutable per-user state.

    Bytewax requires state to be effectively immutable: every transition
    must return a *new* state object rather than mutating the existing
    one.  ``frozen=True`` enforces this at runtime.

    The ``LOGGED_OUT`` state has no associated data, so it is represented
    by ``None`` (which also tells Bytewax to drop the key from its state
    store, freeing memory).
    """

    state: State
    login_ts: int
    large_tx_count: int


# ---------------------------------------------------------------------------
# Event helpers
# ---------------------------------------------------------------------------


def _get_amount(event: Dict[str, Any]) -> float:
    """Return the event ``amount`` (defaulting to ``0`` when absent)."""
    return float(event.get("amount", 0) or 0)


# ---------------------------------------------------------------------------
# State machine
# ---------------------------------------------------------------------------

# Type alias for clarity: the value emitted downstream by ``stateful_map``
# is either ``None`` (no alert) or an alert ``dict``.
Emit = Optional[Dict[str, str]]


def update_state(
    state: Optional[UserState], event: Dict[str, Any]
) -> Tuple[Optional[UserState], Emit]:
    """Advance the state machine for a single user event.

    :param state: The previous state, or ``None`` when the user is
        ``LOGGED_OUT`` (or has never been seen).
    :param event: A decoded event dict with at least ``user_id``,
        ``event_type`` and ``timestamp``; ``amount`` is optional.
    :returns: A 2-tuple ``(new_state, emit)``.  ``new_state`` is ``None``
        when the user is ``LOGGED_OUT`` (so Bytewax discards the state).
        ``emit`` is a fraud-alert dict when an alert fires, otherwise
        ``None``.
    """
    event_type: str = event["event_type"]
    ts: int = int(event["timestamp"])
    user_id: str = event["user_id"]

    # --- login ---------------------------------------------------------
    if event_type == "login":
        new_state = UserState(
            state=State.LOGGED_IN,
            login_ts=ts,
            large_tx_count=0,
        )
        return new_state, None

    # --- logout --------------------------------------------------------
    if event_type == "logout":
        # Immediately return to LOGGED_OUT and discard the state.
        return None, None

    # --- transaction ---------------------------------------------------
    if event_type == "transaction":
        # Transactions are only meaningful during an active session.
        if state is None:
            return None, None

        # If we are past the login window, the session is stale: reset
        # to LOGGED_OUT and ignore the current transaction.
        if ts - state.login_ts > LOGIN_WINDOW_SECONDS:
            return None, None

        amount = _get_amount(event)
        if amount >= LARGE_TX_THRESHOLD:
            new_count = state.large_tx_count + 1
            if new_count >= FRAUD_TX_COUNT:
                # Threshold reached -> emit alert and reset to LOGGED_OUT.
                alert = {"user_id": user_id, "alert": FRAUD_ALERT}
                return None, alert
            # Otherwise become / remain SUSPICIOUS with the new count.
            new_state = UserState(
                state=State.SUSPICIOUS,
                login_ts=state.login_ts,
                large_tx_count=new_count,
            )
            return new_state, None

        # Small transaction: state is unchanged.
        return state, None

    # --- unknown event type -------------------------------------------
    # Be permissive: ignore unknown events and leave state untouched.
    return state, None