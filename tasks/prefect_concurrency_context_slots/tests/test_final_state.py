import asyncio
import json
import os
from datetime import datetime

import pytest

PROJECT_DIR = "/home/user/project"
PROOF_PATH = os.path.join(PROJECT_DIR, "occupancy_proof.json")

LIMIT_NAME = "critical-section"
TOTAL_SLOTS = 4

# Required slot weighting per task id, exactly as stated in the task description.
EXPECTED_SLOTS = {
    "t0": 1,
    "t1": 1,
    "t2": 2,
    "t3": 1,
    "t4": 2,
    "t5": 1,
    "t6": 2,
    "t7": 1,
}


def _load_proof():
    assert os.path.isfile(PROOF_PATH), f"Proof artifact {PROOF_PATH} does not exist."
    with open(PROOF_PATH) as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError as exc:  # pragma: no cover - defensive
            pytest.fail(f"{PROOF_PATH} is not valid JSON: {exc}")
    assert isinstance(data, dict), f"{PROOF_PATH} must contain a JSON object at the top level."
    return data


def _parse_ts(value, label):
    assert isinstance(value, str), f"{label} must be a string ISO-8601 timestamp, got {type(value)!r}."
    try:
        dt = datetime.fromisoformat(value)
    except ValueError as exc:
        pytest.fail(f"{label} value {value!r} is not parseable by datetime.fromisoformat: {exc}")
    assert dt.tzinfo is not None and dt.utcoffset() is not None, (
        f"{label} value {value!r} must be timezone-aware."
    )
    return dt


def test_proof_top_level_fields():
    data = _load_proof()
    assert data.get("limit_name") == LIMIT_NAME, (
        f"'limit_name' must equal {LIMIT_NAME!r}, got {data.get('limit_name')!r}."
    )
    assert data.get("total_slots") == TOTAL_SLOTS, (
        f"'total_slots' must equal {TOTAL_SLOTS}, got {data.get('total_slots')!r}."
    )
    assert isinstance(data.get("tasks"), list), "'tasks' must be a JSON array."


def test_proof_task_entries_and_weights():
    data = _load_proof()
    tasks = data["tasks"]
    assert len(tasks) == len(EXPECTED_SLOTS), (
        f"'tasks' must contain exactly {len(EXPECTED_SLOTS)} entries, got {len(tasks)}."
    )
    seen = {}
    for entry in tasks:
        assert isinstance(entry, dict), f"Each task entry must be an object, got {entry!r}."
        tid = entry.get("task_id")
        assert tid in EXPECTED_SLOTS, f"Unexpected or missing task_id in entry: {entry!r}."
        assert tid not in seen, f"Duplicate task_id {tid!r} found in proof."
        seen[tid] = entry
        assert entry.get("slots") == EXPECTED_SLOTS[tid], (
            f"task_id {tid!r} must occupy {EXPECTED_SLOTS[tid]} slot(s), got {entry.get('slots')!r}."
        )
    missing = set(EXPECTED_SLOTS) - set(seen)
    assert not missing, f"Proof is missing task ids: {sorted(missing)}."


def test_proof_intervals_valid():
    data = _load_proof()
    for entry in data["tasks"]:
        tid = entry.get("task_id")
        entered = _parse_ts(entry.get("entered_at"), f"{tid}.entered_at")
        exited = _parse_ts(entry.get("exited_at"), f"{tid}.exited_at")
        assert entered < exited, (
            f"task_id {tid!r} must have entered_at strictly before exited_at "
            f"({entry.get('entered_at')!r} !< {entry.get('exited_at')!r})."
        )


def test_slot_ceiling_never_exceeded():
    """The slot-weighted occupancy of the critical section must never exceed TOTAL_SLOTS."""
    data = _load_proof()
    events = []  # (timestamp, order, delta) ; order 0 = release before 1 = acquire on ties
    for entry in data["tasks"]:
        tid = entry.get("task_id")
        slots = EXPECTED_SLOTS[tid]
        entered = _parse_ts(entry.get("entered_at"), f"{tid}.entered_at")
        exited = _parse_ts(entry.get("exited_at"), f"{tid}.exited_at")
        events.append((exited, 0, -slots))
        events.append((entered, 1, +slots))
    events.sort(key=lambda e: (e[0], e[1]))

    current = 0
    peak = 0
    for _, _, delta in events:
        current += delta
        peak = max(peak, current)
    assert peak <= TOTAL_SLOTS, (
        f"Slot ceiling violated: peak simultaneous occupancy was {peak}, exceeding {TOTAL_SLOTS}."
    )


def test_slot_ceiling_reached_under_contention():
    """Occupancy must actually reach the ceiling, proving genuine contention across tasks."""
    data = _load_proof()
    events = []
    for entry in data["tasks"]:
        tid = entry.get("task_id")
        slots = EXPECTED_SLOTS[tid]
        entered = _parse_ts(entry.get("entered_at"), f"{tid}.entered_at")
        exited = _parse_ts(entry.get("exited_at"), f"{tid}.exited_at")
        events.append((exited, 0, -slots))
        events.append((entered, 1, +slots))
    events.sort(key=lambda e: (e[0], e[1]))

    current = 0
    peak = 0
    for _, _, delta in events:
        current += delta
        peak = max(peak, current)
    assert peak == TOTAL_SLOTS, (
        f"Expected peak occupancy to reach the ceiling {TOTAL_SLOTS} under contention, "
        f"but the highest simultaneous occupancy observed was {peak}."
    )


def test_named_concurrency_limit_persisted():
    """Use the local Prefect client to confirm the named limit exists with capacity 4 and is active."""
    from prefect.client.orchestration import get_client

    async def _read():
        async with get_client() as client:
            return await client.read_global_concurrency_limit_by_name(LIMIT_NAME)

    gcl = asyncio.run(_read())
    assert gcl is not None, f"Global concurrency limit {LIMIT_NAME!r} was not found."
    assert getattr(gcl, "name", None) == LIMIT_NAME, (
        f"Concurrency limit name mismatch: {getattr(gcl, 'name', None)!r}."
    )
    assert getattr(gcl, "limit", None) == TOTAL_SLOTS, (
        f"Concurrency limit {LIMIT_NAME!r} must have capacity {TOTAL_SLOTS}, "
        f"got {getattr(gcl, 'limit', None)!r}."
    )
    assert getattr(gcl, "active", None) is True, (
        f"Concurrency limit {LIMIT_NAME!r} must be active."
    )


def test_flow_run_completed():
    """Use the local Prefect client to confirm at least one flow run finished in Completed state."""
    from prefect.client.orchestration import get_client

    async def _read():
        async with get_client() as client:
            return await client.read_flow_runs()

    runs = asyncio.run(_read())
    assert runs, "No flow runs were recorded by the local Prefect API."
    completed = []
    for run in runs:
        state = getattr(run, "state", None)
        state_type = getattr(state, "type", None)
        type_value = getattr(state_type, "value", str(state_type))
        if type_value == "COMPLETED":
            completed.append(run)
    assert completed, (
        "Expected at least one flow run in the COMPLETED state, "
        f"found states: {[getattr(getattr(r, 'state', None), 'type', None) for r in runs]}."
    )
