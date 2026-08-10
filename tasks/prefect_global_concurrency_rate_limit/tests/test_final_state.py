import json
import os
import subprocess

PROJECT_DIR = "/home/user/project"
OCCUPANCY_LOG = os.path.join(PROJECT_DIR, "occupancy.jsonl")
LIMIT_NAME = "render-pool"
NUM_UNITS = 12
UNIT_IDS = set(range(NUM_UNITS))

# Generous ceiling: the pipeline spins up Prefect's local/ephemeral API, runs a
# batch of throttled work units (each holding a slot >= 1s) and may block while
# waiting for slots. This bound only guards against deadlocks/hangs.
PIPELINE_TIMEOUT = 600
CLI_TIMEOUT = 180


def _env():
    return os.environ.copy()


def _gcl(*args, stdin=None):
    return subprocess.run(
        ["prefect", "global-concurrency-limit", *args],
        capture_output=True,
        text=True,
        timeout=CLI_TIMEOUT,
        input=stdin,
        env=_env(),
    )


def _set_limit(value):
    """Ensure the limit exists with the given value (update, else create)."""
    r = _gcl("update", LIMIT_NAME, "--limit", str(value))
    if r.returncode != 0:
        c = _gcl("create", LIMIT_NAME, "--limit", str(value))
        assert c.returncode == 0, (
            f"Failed to establish '{LIMIT_NAME}' limit for the test setup. "
            f"update stderr: {r.stderr}\ncreate stderr: {c.stderr}"
        )


def _delete_limit():
    # The delete command prompts for confirmation; answer 'y' non-interactively.
    _gcl("delete", LIMIT_NAME, stdin="y\n")


def _clear_log():
    if os.path.exists(OCCUPANCY_LOG):
        os.remove(OCCUPANCY_LOG)


def _run_pipeline():
    return subprocess.run(
        ["python3", "pipeline.py"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=PIPELINE_TIMEOUT,
        env=_env(),
    )


def _load_events():
    assert os.path.isfile(
        OCCUPANCY_LOG
    ), f"Occupancy log {OCCUPANCY_LOG} was not created by the pipeline."
    events = []
    with open(OCCUPANCY_LOG) as f:
        for lineno, raw in enumerate(f, start=1):
            line = raw.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError as exc:
                raise AssertionError(
                    f"Line {lineno} of {OCCUPANCY_LOG} is not valid JSON "
                    f"(lines must not be corrupted/interleaved): {exc}: {line!r}"
                )
            assert isinstance(obj, dict), (
                f"Line {lineno} of {OCCUPANCY_LOG} is not a JSON object: {line!r}"
            )
            assert set(obj.keys()) == {"event", "unit", "ts"}, (
                f"Line {lineno} must have exactly keys 'event', 'unit', 'ts'; "
                f"got {sorted(obj.keys())}."
            )
            assert obj["event"] in ("acquire", "release"), (
                f"Line {lineno} has invalid 'event' value {obj['event']!r}; "
                "must be 'acquire' or 'release'."
            )
            assert isinstance(obj["unit"], int) and not isinstance(obj["unit"], bool), (
                f"Line {lineno} 'unit' must be an integer; got {obj['unit']!r}."
            )
            assert isinstance(obj["ts"], (int, float)) and not isinstance(
                obj["ts"], bool
            ), f"Line {lineno} 'ts' must be a number; got {obj['ts']!r}."
            events.append(obj)
    return events


def _assert_all_work_completed(events):
    acquires = [e for e in events if e["event"] == "acquire"]
    releases = [e for e in events if e["event"] == "release"]

    assert len(acquires) == NUM_UNITS, (
        f"Expected exactly {NUM_UNITS} 'acquire' events, got {len(acquires)}."
    )
    assert len(releases) == NUM_UNITS, (
        f"Expected exactly {NUM_UNITS} 'release' events (proving every unit "
        f"completed), got {len(releases)}."
    )

    acquire_units = [e["unit"] for e in acquires]
    release_units = [e["unit"] for e in releases]
    assert len(set(acquire_units)) == NUM_UNITS and set(acquire_units) == UNIT_IDS, (
        f"'acquire' events must cover unit ids {sorted(UNIT_IDS)} exactly once; "
        f"got {sorted(acquire_units)}."
    )
    assert len(set(release_units)) == NUM_UNITS and set(release_units) == UNIT_IDS, (
        f"'release' events must cover unit ids {sorted(UNIT_IDS)} exactly once; "
        f"got {sorted(release_units)}."
    )

    acquire_ts = {e["unit"]: e["ts"] for e in acquires}
    release_ts = {e["unit"]: e["ts"] for e in releases}
    for unit in UNIT_IDS:
        assert acquire_ts[unit] <= release_ts[unit], (
            f"Unit {unit} has acquire ts {acquire_ts[unit]} after its release ts "
            f"{release_ts[unit]}; timestamps are inconsistent."
        )


def _max_simultaneous(events):
    # Sweep line over acquire/release timestamps. On ties, process 'release'
    # before 'acquire' so that touching intervals are not counted as overlapping.
    points = []
    for e in events:
        priority = 0 if e["event"] == "release" else 1
        points.append((e["ts"], priority, e["event"]))
    points.sort(key=lambda p: (p[0], p[1]))

    current = 0
    peak = 0
    for _, _, event in points:
        if event == "acquire":
            current += 1
            peak = max(peak, current)
        else:
            current -= 1
    return peak


def _count_valid_releases():
    """Best-effort count of well-formed 'release' events currently on disk."""
    if not os.path.isfile(OCCUPANCY_LOG):
        return 0
    count = 0
    with open(OCCUPANCY_LOG) as f:
        for raw in f:
            line = raw.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(obj, dict) and obj.get("event") == "release":
                count += 1
    return count


def test_limit_created_by_solution():
    """The solution must have created the 'render-pool' limit on the local server."""
    result = _gcl("inspect", LIMIT_NAME)
    assert result.returncode == 0, (
        f"'prefect global-concurrency-limit inspect {LIMIT_NAME}' failed, meaning "
        f"the limit was not created on the local server. stderr: {result.stderr}"
    )
    assert LIMIT_NAME in result.stdout, (
        f"Expected the '{LIMIT_NAME}' concurrency limit to be reported by "
        f"'prefect global-concurrency-limit inspect'. Output: {result.stdout}"
    )


def test_ceiling_of_three_enforced_and_all_work_completes():
    """With the limit at 3, at most 3 units run at once and all 12 finish."""
    _set_limit(3)
    _clear_log()

    result = _run_pipeline()
    assert result.returncode == 0, (
        f"Pipeline exited non-zero with limit=3.\nstdout:\n{result.stdout}\n"
        f"stderr:\n{result.stderr}"
    )

    events = _load_events()
    _assert_all_work_completed(events)

    peak = _max_simultaneous(events)
    assert peak == 3, (
        f"With the '{LIMIT_NAME}' limit set to 3, the maximum number of units "
        f"holding a slot simultaneously must be exactly 3 (reached under "
        f"contention and never exceeded); observed peak was {peak}."
    )


def test_ceiling_tracks_server_side_value_dynamically():
    """Lowering the server-side limit to 2 must lower the enforced ceiling to 2
    without any edit to pipeline.py, proving the ceiling is not hard-coded."""
    _set_limit(2)
    _clear_log()

    result = _run_pipeline()
    assert result.returncode == 0, (
        f"Pipeline exited non-zero with limit=2.\nstdout:\n{result.stdout}\n"
        f"stderr:\n{result.stderr}"
    )

    events = _load_events()
    _assert_all_work_completed(events)

    peak = _max_simultaneous(events)
    assert peak == 2, (
        f"After lowering the '{LIMIT_NAME}' limit to 2, the maximum simultaneous "
        f"slot holders must be exactly 2 (the pipeline must track the server-side "
        f"value dynamically); observed peak was {peak}."
    )


def test_missing_limit_causes_hard_failure():
    """If the limit is absent, the pipeline must fail hard and must not run the
    batch unthrottled."""
    _delete_limit()
    _clear_log()

    try:
        result = _run_pipeline()
        assert result.returncode != 0, (
            "With the '"
            + LIMIT_NAME
            + "' limit deleted, the pipeline must exit with a non-zero status "
            "instead of running the batch unthrottled.\nstdout:\n"
            + result.stdout
            + "\nstderr:\n"
            + result.stderr
        )
        valid_releases = _count_valid_releases()
        assert valid_releases < NUM_UNITS, (
            "With the limit deleted, the pipeline must not have completed all "
            f"{NUM_UNITS} work units; found {valid_releases} 'release' events, "
            "indicating an unthrottled run."
        )
    finally:
        # Restore the limit so the environment is left in a clean state.
        _set_limit(3)
