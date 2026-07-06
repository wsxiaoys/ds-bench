"""Unit tests for the fraud-detection state machine.

Run with::

    python -m pytest test_state_machine.py -v

or simply::

    python test_state_machine.py
"""

from __future__ import annotations

import unittest

from state_machine import (
    FRAUD_ALERT,
    LOGIN_WINDOW_SECONDS,
    State,
    UserState,
    update_state,
)


def _login(uid: str, ts: int) -> dict:
    return {"user_id": uid, "event_type": "login", "timestamp": ts}


def _tx(uid: str, amount: float, ts: int) -> dict:
    return {"user_id": uid, "event_type": "transaction", "amount": amount, "timestamp": ts}


def _logout(uid: str, ts: int) -> dict:
    return {"user_id": uid, "event_type": "logout", "timestamp": ts}


class StateMachineTests(unittest.TestCase):
    # --- login / logout ------------------------------------------------

    def test_login_transitions_to_logged_in(self):
        new, emit = update_state(None, _login("u", 100))
        self.assertIsNone(emit)
        self.assertEqual(new.state, State.LOGGED_IN)
        self.assertEqual(new.login_ts, 100)
        self.assertEqual(new.large_tx_count, 0)

    def test_logout_resets_to_logged_out(self):
        state = UserState(State.LOGGED_IN, 100, 1)
        new, emit = update_state(state, _logout("u", 200))
        self.assertIsNone(new)
        self.assertIsNone(emit)

    def test_logout_from_logged_out_stays_logged_out(self):
        new, emit = update_state(None, _logout("u", 200))
        self.assertIsNone(new)
        self.assertIsNone(emit)

    # --- transactions while logged out --------------------------------

    def test_transaction_while_logged_out_ignored(self):
        new, emit = update_state(None, _tx("u", 5000, 100))
        self.assertIsNone(new)
        self.assertIsNone(emit)

    # --- large transactions -------------------------------------------

    def test_large_tx_increments_and_becomes_suspicious(self):
        state, _ = update_state(None, _login("u", 100))
        new, emit = update_state(state, _tx("u", 1500, 150))
        self.assertEqual(new.state, State.SUSPICIOUS)
        self.assertEqual(new.large_tx_count, 1)
        self.assertIsNone(emit)

    def test_small_tx_does_not_increment(self):
        state, _ = update_state(None, _login("u", 100))
        new, emit = update_state(state, _tx("u", 500, 150))
        self.assertEqual(new.state, State.LOGGED_IN)
        self.assertEqual(new.large_tx_count, 0)
        self.assertIsNone(emit)

    def test_three_large_tx_emits_alert_and_resets(self):
        state, _ = update_state(None, _login("u", 1000))
        state, emit = update_state(state, _tx("u", 1500, 1100))
        self.assertIsNone(emit)
        state, emit = update_state(state, _tx("u", 2000, 1200))
        self.assertIsNone(emit)
        state, emit = update_state(state, _tx("u", 1200, 1300))
        self.assertEqual(emit, {"user_id": "u", "alert": FRAUD_ALERT})
        self.assertIsNone(state)  # reset to LOGGED_OUT

    def test_alert_then_can_relogin_and_alert_again(self):
        state, _ = update_state(None, _login("u", 1000))
        state, _ = update_state(state, _tx("u", 1500, 1100))
        state, _ = update_state(state, _tx("u", 2000, 1200))
        state, emit = update_state(state, _tx("u", 1200, 1300))
        self.assertIsNotNone(emit)
        self.assertIsNone(state)

        state, _ = update_state(None, _login("u", 2000))
        state, _ = update_state(state, _tx("u", 1500, 2100))
        state, _ = update_state(state, _tx("u", 2000, 2200))
        state, emit = update_state(state, _tx("u", 1500, 2300))
        self.assertEqual(emit, {"user_id": "u", "alert": FRAUD_ALERT})

    # --- login window --------------------------------------------------

    def test_tx_exactly_at_window_boundary_is_included(self):
        # ts - login == LOGIN_WINDOW_SECONDS is still within the window.
        state, _ = update_state(None, _login("u", 1000))
        new, emit = update_state(state, _tx("u", 1500, 1000 + LOGIN_WINDOW_SECONDS))
        self.assertEqual(new.state, State.SUSPICIOUS)
        self.assertEqual(new.large_tx_count, 1)
        self.assertIsNone(emit)

    def test_tx_just_past_window_resets_and_ignores(self):
        state, _ = update_state(None, _login("u", 1000))
        # Accumulate two large tx inside the window.
        state, _ = update_state(state, _tx("u", 1500, 1100))
        state, _ = update_state(state, _tx("u", 2000, 1200))
        # Third large tx outside the window -> reset, no alert.
        new, emit = update_state(state, _tx("u", 5000, 1000 + LOGIN_WINDOW_SECONDS + 1))
        self.assertIsNone(new)
        self.assertIsNone(emit)

    def test_logout_prevents_alert(self):
        state, _ = update_state(None, _login("u", 1000))
        state, _ = update_state(state, _tx("u", 1500, 1100))
        state, _ = update_state(state, _tx("u", 2000, 1200))
        state, emit = update_state(state, _logout("u", 1250))
        self.assertIsNone(emit)
        self.assertIsNone(state)
        # A subsequent transaction is ignored (LOGGED_OUT).
        new, emit = update_state(state, _tx("u", 5000, 1300))
        self.assertIsNone(new)
        self.assertIsNone(emit)

    # --- immutability --------------------------------------------------

    def test_state_is_immutable(self):
        state, _ = update_state(None, _login("u", 1000))
        with self.assertRaises(Exception):
            state.login_ts = 999  # type: ignore[misc]

    # --- unknown events ------------------------------------------------

    def test_unknown_event_ignored(self):
        state, _ = update_state(None, _login("u", 1000))
        new, emit = update_state(state, {"user_id": "u", "event_type": "noop", "timestamp": 1100})
        self.assertEqual(new, state)
        self.assertIsNone(emit)


if __name__ == "__main__":
    unittest.main()