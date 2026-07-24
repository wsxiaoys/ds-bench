import json
import os
import subprocess
import tempfile
from concurrent.futures import ThreadPoolExecutor

import pytest

PROJECT_DIR = "/home/user/project"

# The single source of truth for legal transitions, used as an independent
# oracle for chain-validity checks (see the transition table in the task).
LEGAL = {
    "pending": {"paid", "cancelled"},
    "paid": {"shipped", "cancelled"},
    "shipped": {"delivered"},
    "delivered": set(),
    "cancelled": set(),
}

EXPECTED_TABLE = {
    "pending": ["cancelled", "paid"],
    "paid": ["cancelled", "shipped"],
    "shipped": ["delivered"],
    "delivered": [],
    "cancelled": [],
}


def run_cli(args, timeout=60):
    """Run `node cli.js <args>` in the project dir; return (returncode, stdout, stderr)."""
    result = subprocess.run(
        ["node", "cli.js", *args],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    return result.returncode, result.stdout, result.stderr


def parse_last_json(stdout):
    """Parse the last non-empty line of stdout as JSON."""
    lines = [ln for ln in stdout.splitlines() if ln.strip()]
    assert lines, f"Expected JSON on stdout but got nothing. stdout={stdout!r}"
    return json.loads(lines[-1])


def fresh_db():
    d = tempfile.mkdtemp(prefix="osm_")
    return os.path.join(d, "verify.sqlite")


def create_order(db):
    rc, out, err = run_cli(["create", "--db", db])
    assert rc == 0, f"create failed rc={rc} stderr={err}"
    data = parse_last_json(out)
    assert data.get("status") == "pending", f"new order not pending: {data}"
    assert isinstance(data.get("id"), int), f"create must return integer id: {data}"
    return data["id"]


def transition(db, oid, to):
    return run_cli(["transition", "--db", db, "--id", str(oid), "--to", to])


def show(db, oid):
    rc, out, err = run_cli(["show", "--db", db, "--id", str(oid)])
    return rc, parse_last_json(out), err


# ---------------------------------------------------------------------------
# 1. Transition table is data-driven and correct
# ---------------------------------------------------------------------------
def test_transitions_table_matches_spec():
    db = fresh_db()
    rc, out, err = run_cli(["transitions", "--db", db])
    assert rc == 0, f"transitions command failed rc={rc} stderr={err}"
    table = parse_last_json(out)
    assert set(table.keys()) == set(EXPECTED_TABLE.keys()), (
        f"transition table keys mismatch: {table}"
    )
    for status, targets in EXPECTED_TABLE.items():
        assert table[status] == targets, (
            f"transition targets for {status!r} must be {targets} (sorted), got {table[status]}"
        )


# ---------------------------------------------------------------------------
# 2. Happy-path chain with atomic history recording
# ---------------------------------------------------------------------------
def test_happy_path_chain_and_history():
    db = fresh_db()
    oid = create_order(db)

    for frm, to in [("pending", "paid"), ("paid", "shipped"), ("shipped", "delivered")]:
        rc, out, err = transition(db, oid, to)
        assert rc == 0, f"legal transition {frm}->{to} failed rc={rc} stderr={err}"
        data = parse_last_json(out)
        assert data.get("ok") is True, f"expected ok:true for {frm}->{to}, got {data}"
        assert data.get("from") == frm and data.get("to") == to, (
            f"transition reported wrong from/to: {data}"
        )

    rc, state, err = show(db, oid)
    assert rc == 0, f"show failed rc={rc} stderr={err}"
    assert state["status"] == "delivered", f"final status should be delivered: {state}"
    hist = state["history"]
    assert len(hist) == 3, f"expected exactly 3 history rows, got {hist}"
    expected_chain = [("pending", "paid"), ("paid", "shipped"), ("shipped", "delivered")]
    for row, (frm, to) in zip(hist, expected_chain):
        assert row["fromStatus"] == frm and row["toStatus"] == to, (
            f"history row mismatch: {row} expected {frm}->{to}"
        )
        assert isinstance(row.get("at"), str) and row["at"], (
            f"history row missing 'at' timestamp: {row}"
        )
    # timestamps must be non-decreasing in chronological order
    ats = [row["at"] for row in hist]
    assert ats == sorted(ats), f"history not chronologically ordered: {ats}"


# ---------------------------------------------------------------------------
# 3. Illegal transition leaves no change and no history row (rollback)
# ---------------------------------------------------------------------------
def test_illegal_transition_no_side_effects():
    db = fresh_db()
    oid = create_order(db)

    for to in ["shipped", "delivered", "pending"]:  # all illegal from pending
        rc, out, err = transition(db, oid, to)
        assert rc == 3, f"illegal transition pending->{to} must exit 3, got {rc} stderr={err}"
        data = parse_last_json(out)
        assert data.get("ok") is False and data.get("error") == "ILLEGAL_TRANSITION", (
            f"expected ILLEGAL_TRANSITION for pending->{to}, got {data}"
        )
        assert data.get("from") == "pending" and data.get("to") == to, (
            f"illegal transition payload wrong: {data}"
        )

    rc, state, err = show(db, oid)
    assert rc == 0, f"show failed: {err}"
    assert state["status"] == "pending", f"status must be unchanged: {state}"
    assert state["history"] == [], f"no history rows allowed after illegal attempts: {state}"


# ---------------------------------------------------------------------------
# 4. shipped cannot be cancelled; delivered is terminal
# ---------------------------------------------------------------------------
def test_shipped_not_cancellable_and_delivered_terminal():
    db = fresh_db()
    oid = create_order(db)
    assert transition(db, oid, "paid")[0] == 0
    assert transition(db, oid, "shipped")[0] == 0

    rc, out, err = transition(db, oid, "cancelled")
    assert rc == 3, f"shipped->cancelled must be illegal, got rc={rc} stderr={err}"
    assert parse_last_json(out).get("error") == "ILLEGAL_TRANSITION"

    assert transition(db, oid, "delivered")[0] == 0, "shipped->delivered must be legal"

    for to in ["shipped", "cancelled", "paid", "pending", "delivered"]:
        rc, out, err = transition(db, oid, to)
        assert rc == 3, f"delivered->{to} must be illegal (terminal), got rc={rc}"
        assert parse_last_json(out).get("error") == "ILLEGAL_TRANSITION"

    rc, state, err = show(db, oid)
    assert state["status"] == "delivered", f"status should remain delivered: {state}"
    assert len(state["history"]) == 3, f"exactly 3 accepted transitions expected: {state}"


# ---------------------------------------------------------------------------
# 5. cancelled is terminal
# ---------------------------------------------------------------------------
def test_cancelled_terminal():
    db = fresh_db()
    oid = create_order(db)
    assert transition(db, oid, "cancelled")[0] == 0, "pending->cancelled must be legal"

    for to in ["paid", "pending", "shipped", "delivered"]:
        rc, out, err = transition(db, oid, to)
        assert rc == 3, f"cancelled->{to} must be illegal (terminal), got rc={rc}"
        assert parse_last_json(out).get("error") == "ILLEGAL_TRANSITION"

    rc, state, err = show(db, oid)
    assert state["status"] == "cancelled", f"status should remain cancelled: {state}"
    assert len(state["history"]) == 1, f"exactly one history row expected: {state}"
    assert state["history"][0]["fromStatus"] == "pending"
    assert state["history"][0]["toStatus"] == "cancelled"


# ---------------------------------------------------------------------------
# 6. NOT_FOUND handling
# ---------------------------------------------------------------------------
def test_not_found_handling():
    db = fresh_db()
    rc, out, err = run_cli(["init", "--db", db])
    assert rc == 0, f"init failed rc={rc} stderr={err}"

    rc, out, err = transition(db, 999999, "paid")
    assert rc == 4, f"transition on missing id must exit 4, got {rc} stderr={err}"
    data = parse_last_json(out)
    assert data.get("error") == "NOT_FOUND" and data.get("id") == 999999, (
        f"expected NOT_FOUND for missing id, got {data}"
    )

    rc, out, err = run_cli(["show", "--db", db, "--id", "999999"])
    assert rc == 4, f"show on missing id must exit 4, got {rc}"
    assert parse_last_json(out).get("error") == "NOT_FOUND"


# ---------------------------------------------------------------------------
# 7. Concurrency: exactly one winner advancing the same order to same target
# ---------------------------------------------------------------------------
def test_concurrency_same_target_exactly_one_winner():
    db = fresh_db()
    oid = create_order(db)

    N = 20

    with ThreadPoolExecutor(max_workers=N) as ex:
        # Bound total wall-clock time to catch deadlocks/livelocks.
        results = list(ex.map(lambda i: transition(db, oid, "paid"), range(N)))

    codes = [rc for rc, _, _ in results]
    winners = [c for c in codes if c == 0]
    losers = [c for c in codes if c == 3]
    assert len(winners) == 1, f"expected exactly one successful transition, got codes={codes}"
    assert len(losers) == N - 1, (
        f"all non-winners must fail with ILLEGAL_TRANSITION (exit 3), got codes={codes}"
    )

    rc, state, err = show(db, oid)
    assert state["status"] == "paid", f"final status must be paid: {state}"
    assert len(state["history"]) == 1, (
        f"exactly one history row must exist after concurrent attempts: {state}"
    )
    assert state["history"][0]["fromStatus"] == "pending"
    assert state["history"][0]["toStatus"] == "paid"


# ---------------------------------------------------------------------------
# 8. Concurrency: racing to different targets stays consistent (invariant graded)
# ---------------------------------------------------------------------------
def test_concurrency_different_targets_consistent():
    db = fresh_db()
    oid = create_order(db)

    targets = ["paid", "cancelled"] * 8  # 16 concurrent, split between two legal targets

    with ThreadPoolExecutor(max_workers=len(targets)) as ex:
        results = list(ex.map(lambda t: transition(db, oid, t), targets))

    codes = [rc for rc, _, _ in results]
    winners = [c for c in codes if c == 0]
    assert len(winners) == 1, f"expected exactly one winner, got codes={codes}"
    assert all(c in (0, 3) for c in codes), f"unexpected exit codes: {codes}"
    assert codes.count(3) == len(targets) - 1, f"all losers must exit 3: {codes}"

    rc, state, err = show(db, oid)
    assert state["status"] in ("paid", "cancelled"), f"final status invalid: {state}"
    assert len(state["history"]) == 1, f"exactly one history row expected: {state}"
    row = state["history"][0]
    assert row["fromStatus"] == "pending", f"history must start from pending: {row}"
    assert row["toStatus"] == state["status"], (
        f"history toStatus must equal final status: row={row} status={state['status']}"
    )


# ---------------------------------------------------------------------------
# 9. History always forms a valid, non-skipping transition chain
# ---------------------------------------------------------------------------
def test_history_forms_valid_chain():
    db = fresh_db()
    oid = create_order(db)
    # Drive a mix of legal and illegal attempts; only legal ones may be recorded.
    for to in ["shipped", "paid", "cancelled", "shipped", "delivered", "paid"]:
        transition(db, oid, to)

    rc, state, err = show(db, oid)
    assert rc == 0, f"show failed: {err}"
    hist = state["history"]
    status = state["status"]

    prev = "pending"
    for row in hist:
        assert row["fromStatus"] == prev, (
            f"chain broken: expected fromStatus {prev}, got {row}"
        )
        assert row["toStatus"] in LEGAL[row["fromStatus"]], (
            f"recorded transition {row['fromStatus']}->{row['toStatus']} is not legal"
        )
        prev = row["toStatus"]

    expected_status = hist[-1]["toStatus"] if hist else "pending"
    assert status == expected_status, (
        f"current status {status} must equal last history toStatus {expected_status}"
    )
