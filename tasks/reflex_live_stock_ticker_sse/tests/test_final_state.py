"""Final-state verification for the live_stock_ticker_sse task.

These tests are executed by the system python3 (NOT inside the executor's
uv-managed environment). They drive the Reflex backend via the REST surface
that the executor was asked to expose under `/api/ticker/...`.
"""

import json
import os
import socket
import subprocess
import time

import portpicker
import pytest
import requests
from xprocess import ProcessStarter


PROJECT_DIR = "/home/user/ticker_app"
BACKEND_HOST = "127.0.0.1"

EXPECTED_SEEDS = {
    "AAPL": 150.0,
    "GOOG": 2800.0,
    "MSFT": 300.0,
    "AMZN": 3300.0,
    "TSLA": 700.0,
}
EXPECTED_SYMBOLS = set(EXPECTED_SEEDS.keys())


def _port_open(host: str, port: int, timeout: float = 0.5) -> bool:
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        sock.settimeout(timeout)
        return sock.connect_ex((host, port)) == 0
    finally:
        sock.close()


def _wait_for_snapshot(app_port: int, timeout: float = 90.0) -> bool:
    """Poll the snapshot endpoint until it returns HTTP 200 or we time out."""
    deadline = time.time() + timeout
    url = f"http://{BACKEND_HOST}:{app_port}/api/ticker/snapshot"
    while time.time() < deadline:
        try:
            resp = requests.get(url, timeout=2.0)
            if resp.status_code == 200:
                # Validate response is JSON-decodable before returning ready.
                resp.json()
                return True
        except (requests.RequestException, ValueError):
            pass
        time.sleep(0.5)
    return False


@pytest.fixture(scope="session")
def app_port():
    """Finds a free port on localhost."""
    return portpicker.pick_unused_port()


@pytest.fixture(scope="session")
def reflex_backend(xprocess, app_port):
    """Start the Reflex backend in `--backend-only` mode and wait for readiness."""

    if not os.path.isdir(PROJECT_DIR):
        pytest.fail(
            f"Project directory {PROJECT_DIR} does not exist. The executor "
            f"must create the Reflex app at this path."
        )

    class Starter(ProcessStarter):
        name = "reflex_backend"
        args = [
            "uv",
            "run",
            "reflex",
            "run",
            "--backend-only",
            "--backend-port",
            str(app_port),
            "--loglevel",
            "warning",
        ]
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 240
        terminate_on_interrupt = True

        def startup_check(self):
            return _wait_for_snapshot(app_port, timeout=2.0)

    info = xprocess.getinfo(Starter.name)

    def capture_logs(tag):
        with open(info.logpath, "r") as f:
            logs = f.read()
            print(f"============================== [{tag}: Begin] Captured {Starter.name} logfile ==============================")
            print(logs)
            print(f"============================== [{tag}: End  ] Captured {Starter.name} logfile ==============================")

    started = False
    try:
        # ensure() starts the process and blocks until startup_check is True
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    # Extra wait: the snapshot endpoint MUST be responding before tests start.
    assert _wait_for_snapshot(app_port, timeout=90.0), (
        f"Reflex backend never became ready at http://{BACKEND_HOST}:{app_port}/api/ticker/snapshot; the executor's "
        f"app may not have implemented the snapshot endpoint correctly."
    )

    yield

    capture_logs("TEARDOWN")
    try:
        info.terminate()
    except Exception:
        pass
    # Belt-and-suspenders: kill anything still on the port.
    if _port_open(BACKEND_HOST, app_port):
        subprocess.run(
            ["fuser", "-k", f"{app_port}/tcp"],
            capture_output=True,
            check=False,
        )


def _snapshot(app_port: int) -> dict:
    url = f"http://{BACKEND_HOST}:{app_port}/api/ticker/snapshot"
    resp = requests.get(url, timeout=5.0)
    assert resp.status_code == 200, (
        f"GET {url} returned HTTP {resp.status_code} instead of "
        f"200. Body: {resp.text[:500]}"
    )
    try:
        data = resp.json()
    except ValueError as exc:
        raise AssertionError(
            f"GET {url} did not return valid JSON: {exc}; "
            f"body: {resp.text[:500]}"
        )
    return data


def _post(url: str) -> dict:
    resp = requests.post(url, timeout=5.0)
    assert resp.status_code == 200, (
        f"POST {url} returned HTTP {resp.status_code}; body: {resp.text[:500]}"
    )
    try:
        return resp.json()
    except ValueError as exc:
        raise AssertionError(
            f"POST {url} did not return JSON: {exc}; body: {resp.text[:500]}"
        )


def _ensure_stopped(app_port: int):
    """Stop the ticker and wait until update_count stabilises."""
    url = f"http://{BACKEND_HOST}:{app_port}/api/ticker/stop"
    try:
        requests.post(url, timeout=5.0)
    except requests.RequestException:
        pass
    time.sleep(1.0)


def _measure_rate(app_port: int, window_seconds: float) -> int:
    """Return delta of update_count over the window."""
    start = _snapshot(app_port)["update_count"]
    time.sleep(window_seconds)
    end = _snapshot(app_port)["update_count"]
    return int(end) - int(start)


def test_snapshot_shape_and_seeds(reflex_backend, app_port):
    _ensure_stopped(app_port)
    snap = _snapshot(app_port)

    for key in ("running", "update_count", "seeds", "prices", "percent_changes"):
        assert key in snap, (
            f"Snapshot JSON is missing required key '{key}'. Got keys: "
            f"{list(snap.keys())}"
        )

    assert isinstance(snap["running"], bool), (
        f"snapshot['running'] must be a bool, got {type(snap['running']).__name__}"
    )
    assert isinstance(snap["update_count"], int), (
        f"snapshot['update_count'] must be an int, got "
        f"{type(snap['update_count']).__name__}"
    )

    for field in ("seeds", "prices", "percent_changes"):
        assert isinstance(snap[field], dict), (
            f"snapshot['{field}'] must be a JSON object/dict, got "
            f"{type(snap[field]).__name__}"
        )
        assert set(snap[field].keys()) == EXPECTED_SYMBOLS, (
            f"snapshot['{field}'] must contain exactly the symbols "
            f"{sorted(EXPECTED_SYMBOLS)}, got {sorted(snap[field].keys())}"
        )

    for symbol, expected_seed in EXPECTED_SEEDS.items():
        actual_seed = float(snap["seeds"][symbol])
        assert abs(actual_seed - expected_seed) < 1e-6, (
            f"snapshot['seeds']['{symbol}'] must be {expected_seed}, "
            f"got {actual_seed}"
        )


def test_idempotent_start_first_call_returns_started_true(reflex_backend, app_port):
    _ensure_stopped(app_port)
    start_url = f"http://{BACKEND_HOST}:{app_port}/api/ticker/start"
    body = _post(start_url)
    assert body.get("running") is True, (
        f"First /api/ticker/start should report running=true; got {body}"
    )
    assert body.get("started") is True, (
        f"First /api/ticker/start should report started=true (a fresh loop "
        f"was spawned); got {body}"
    )
    # Leave it running for the next test.


def test_at_least_five_distinct_updates_in_five_seconds(reflex_backend, app_port):
    # Ensure clean baseline.
    _ensure_stopped(app_port)
    start_url = f"http://{BACKEND_HOST}:{app_port}/api/ticker/start"
    start_body = _post(start_url)
    assert start_body.get("running") is True, (
        f"/api/ticker/start should mark running=true; got {start_body}"
    )

    seen = set()
    max_count = 0
    deadline = time.time() + 5.5
    while time.time() < deadline:
        snap = _snapshot(app_port)
        seen.add(int(snap["update_count"]))
        max_count = max(max_count, int(snap["update_count"]))
        time.sleep(0.5)

    assert len(seen) >= 5, (
        f"Expected at least 5 distinct update_count values within 5 seconds, "
        f"got only {len(seen)} distinct values: {sorted(seen)}"
    )
    assert max_count >= 5, (
        f"Expected max update_count >= 5 within 5 seconds, got {max_count}"
    )


def test_idempotent_start_does_not_double_rate(reflex_backend, app_port):
    """Second start while running must report started=false and not double rate."""
    # Make sure we are running.
    snap = _snapshot(app_port)
    if not snap["running"]:
        start_url = f"http://{BACKEND_HOST}:{app_port}/api/ticker/start"
        _post(start_url)
        time.sleep(1.0)

    rate_single = _measure_rate(app_port, 3.0)
    assert rate_single >= 3, (
        f"Expected at least ~3 updates over a 3s window after a single start, "
        f"got delta={rate_single}. The background loop appears too slow."
    )

    start_url = f"http://{BACKEND_HOST}:{app_port}/api/ticker/start"
    body = _post(start_url)
    assert body.get("running") is True, (
        f"Second /api/ticker/start should still report running=true; got {body}"
    )
    assert body.get("started") is False, (
        f"Second /api/ticker/start while already running MUST report "
        f"started=false (no duplicate loop spawned); got {body}"
    )

    rate_double = _measure_rate(app_port, 3.0)
    assert rate_double <= rate_single * 1.5 + 1, (
        f"Tick rate after second start (delta={rate_double}) is too high "
        f"compared to first window (delta={rate_single}); this suggests a "
        f"duplicate background loop was spawned."
    )


def test_percent_change_correctness(reflex_backend, app_port):
    snap = _snapshot(app_port)
    if not snap["running"]:
        start_url = f"http://{BACKEND_HOST}:{app_port}/api/ticker/start"
        _post(start_url)
        time.sleep(1.0)
        snap = _snapshot(app_port)

    assert int(snap["update_count"]) >= 1, (
        f"Need at least one tick before checking percent_change correctness; "
        f"update_count={snap['update_count']}"
    )

    for symbol in EXPECTED_SYMBOLS:
        price = float(snap["prices"][symbol])
        seed = float(snap["seeds"][symbol])
        assert price > 0, (
            f"Price for {symbol} must stay strictly positive, got {price}"
        )
        expected_pct = round((price - seed) / seed * 100.0, 4)
        actual_pct = float(snap["percent_changes"][symbol])
        assert abs(actual_pct - expected_pct) < 1e-3, (
            f"percent_changes['{symbol}'] = {actual_pct} does not match the "
            f"required formula round((price - seed) / seed * 100, 4) = "
            f"{expected_pct} (price={price}, seed={seed})"
        )


def test_stop_halts_updates(reflex_backend, app_port):
    snap = _snapshot(app_port)
    if not snap["running"]:
        start_url = f"http://{BACKEND_HOST}:{app_port}/api/ticker/start"
        _post(start_url)
        time.sleep(1.0)

    stop_url = f"http://{BACKEND_HOST}:{app_port}/api/ticker/stop"
    stop_body = _post(stop_url)
    assert stop_body.get("running") is False, (
        f"/api/ticker/stop response must report running=false; got {stop_body}"
    )

    time.sleep(0.5)
    snap_a = _snapshot(app_port)
    assert snap_a["running"] is False, (
        f"snapshot.running must be false after stop; got {snap_a}"
    )

    time.sleep(2.5)
    snap_b = _snapshot(app_port)
    assert snap_b["running"] is False, (
        f"snapshot.running must remain false 2.5s after stop; got {snap_b}"
    )
    assert int(snap_b["update_count"]) == int(snap_a["update_count"]), (
        f"update_count must NOT advance after stop. Got "
        f"{snap_a['update_count']} -> {snap_b['update_count']}."
    )


def test_all_prices_stay_positive(reflex_backend, app_port):
    """Final defensive check: prices never collapse to zero / negative."""
    snap = _snapshot(app_port)
    for symbol in EXPECTED_SYMBOLS:
        price = float(snap["prices"][symbol])
        assert price > 0, (
            f"Price for {symbol} must stay strictly positive, got {price}"
        )
