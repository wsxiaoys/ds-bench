import os
import socket
import time

import pytest
import requests
from playwright.sync_api import sync_playwright
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/app"
PORT = 5173
# Bind/connect over IPv4 explicitly. On Node 17+ `localhost` can resolve to the
# IPv6 loopback (::1); forcing 127.0.0.1 keeps the server, readiness check and
# browser all on the same address.
HOST = "127.0.0.1"
BASE_URL = f"http://{HOST}:{PORT}"
METRICS_URL = f"{BASE_URL}/metrics"

# Single atomic DOM snapshot so a value read never races the live stream.
JS_SNAPSHOT = """
() => {
  const q = (s) => document.querySelector(s);
  const text = (s) => { const el = q(s); return el ? el.textContent.trim() : null; };
  const ticks = Array.from(
    document.querySelectorAll('[data-testid="history"] [data-testid^="tick-"]')
  ).map((e) => ({
    seq: Number(e.getAttribute('data-seq')),
    value: Number(e.getAttribute('data-value')),
    alert: e.getAttribute('data-alert') === 'true',
    testid: e.getAttribute('data-testid'),
  }));
  const cv = q('[data-testid="current-value"]');
  return {
    ticks,
    count: text('[data-testid="tick-count"]'),
    min: text('[data-testid="min-value"]'),
    max: text('[data-testid="max-value"]'),
    alertCount: text('[data-testid="alert-count"]'),
    current: cv ? cv.textContent.trim() : null,
    over: cv ? cv.getAttribute('data-over') === 'true' : false,
  };
}
"""


# --------------------------------------------------------------------------- #
# App lifecycle
# --------------------------------------------------------------------------- #
@pytest.fixture(scope="session")
def start_app(xprocess):
    class Starter(ProcessStarter):
        name = "rwsdk_metrics_app"
        args = [
            "npm",
            "run",
            "dev",
            "--",
            "--port",
            str(PORT),
            "--strictPort",
            "--host",
            HOST,
        ]
        env = os.environ.copy()
        popen_kwargs = {"cwd": PROJECT_DIR, "text": True}
        timeout = 300
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex((HOST, PORT)) != 0:
                    return False
            # The Vite/Cloudflare dev server bundles on the first request, which
            # can take a while; be patient before declaring readiness.
            try:
                resp = requests.get(METRICS_URL, timeout=60)
                return resp.status_code < 500
            except requests.RequestException:
                return False

    info = xprocess.getinfo(Starter.name)
    printed = 0

    def capture_logs(tag):
        nonlocal printed
        try:
            with open(info.logpath, "r") as f:
                lines = f.readlines()
        except OSError:
            return
        new = lines[printed:]
        printed = len(lines)
        print(f"===== [{tag}] {Starter.name} log begin =====")
        print("".join(new))
        print(f"===== [{tag}] {Starter.name} log end =====")

    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield BASE_URL

    capture_logs("TEARDOWN")
    info.terminate()


@pytest.fixture(scope="session")
def browser(start_app):
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)
        yield b
        b.close()


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def to_int(label, raw):
    assert raw is not None, f"{label} widget is missing (text was None)."
    raw = str(raw).strip()
    try:
        return int(raw)
    except ValueError:
        raise AssertionError(f"{label} widget must be an integer, got {raw!r}.")


def snapshot(page):
    return page.evaluate(JS_SNAPSHOT)


def max_seq(snap):
    return max((t["seq"] for t in snap["ticks"]), default=0)


def tick_map(snap):
    return {t["seq"]: t["value"] for t in snap["ticks"]}


def wait_until(fn, timeout=15.0, interval=0.4, msg="condition not met in time"):
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        last = fn()
        if last:
            return last
        time.sleep(interval)
    raise AssertionError(f"{msg} (last value: {last!r})")


def open_metrics(browser):
    ctx = browser.new_context()
    page = ctx.new_page()
    page.goto(METRICS_URL, wait_until="domcontentloaded")
    page.wait_for_selector('[data-testid="start-stream"]', timeout=30000)
    page.wait_for_selector('[data-testid="tick-count"]', timeout=30000)
    # Give the client entry a moment to hydrate so control clicks are wired up.
    page.wait_for_timeout(2000)
    return ctx, page


# --------------------------------------------------------------------------- #
# End-to-end verification (single ordered flow: one shared server producer)
# --------------------------------------------------------------------------- #
def test_metrics_stream_dashboard_end_to_end(browser):
    ctx_a, page_a = open_metrics(browser)
    ctx_b, page_b = open_metrics(browser)

    # --- Step 1: pristine initial state in context A ---------------------- #
    snap = snapshot(page_a)
    assert to_int("tick-count", snap["count"]) == 0, (
        f"Before starting, tick-count must be 0, got {snap['count']!r}."
    )
    assert to_int("alert-count", snap["alertCount"]) == 0, (
        f"Before starting, alert-count must be 0, got {snap['alertCount']!r}."
    )
    assert len(snap["ticks"]) == 0, (
        f"Before starting, history must be empty, got {len(snap['ticks'])} ticks."
    )

    # --- Step 2: start the server-driven stream from A -------------------- #
    # Click start; if the first click landed before the client finished
    # hydrating, re-click until the stream actually begins.
    page_a.click('[data-testid="start-stream"]')

    def stream_started():
        if to_int("tick-count", snapshot(page_a)["count"]) > 0:
            return True
        page_a.click('[data-testid="start-stream"]')
        return False

    wait_until(
        stream_started,
        timeout=25.0,
        interval=2.0,
        msg="tick-count in A did not grow after clicking start-stream",
    )
    c1 = to_int("tick-count", snapshot(page_a)["count"])
    time.sleep(3.0)
    c2 = to_int("tick-count", snapshot(page_a)["count"])
    assert c2 > c1, f"tick-count in A must keep increasing while running ({c1} -> {c2})."

    # seq numbers must be consecutive starting at 1
    snap_a = snapshot(page_a)
    seqs = sorted(t["seq"] for t in snap_a["ticks"])
    assert seqs == list(range(1, len(seqs) + 1)), (
        f"seq values must be consecutive integers starting at 1, got {seqs}."
    )
    for t in snap_a["ticks"]:
        assert 1 <= t["value"] <= 100, (
            f"tick value must be an integer in 1..100, got {t['value']} for seq {t['seq']}."
        )
        assert t["testid"] == f"tick-{t['seq']}", (
            f"tick element data-testid must be tick-<seq>; got {t['testid']} for seq {t['seq']}."
        )

    # --- Step 3: the stream is shared across contexts --------------------- #
    wait_until(
        lambda: to_int("tick-count", snapshot(page_b)["count"]) > 0,
        timeout=20.0,
        msg="context B (which never clicked start) did not see the shared stream",
    )
    # Let both advance, then compare overlapping seq->value pairs.
    time.sleep(3.0)
    map_a = tick_map(snapshot(page_a))
    map_b = tick_map(snapshot(page_b))
    common = set(map_a) & set(map_b)
    assert len(common) >= 3, (
        f"Both contexts should share several ticks; common seqs={sorted(common)}."
    )
    for s in common:
        assert map_a[s] == map_b[s], (
            f"Shared producer mismatch at seq {s}: A={map_a[s]} vs B={map_b[s]}."
        )

    # --- Step 4: cadence is roughly one tick per second ------------------- #
    base = max_seq(snapshot(page_a))
    time.sleep(6.0)
    after = max_seq(snapshot(page_a))
    delta = after - base
    assert 3 <= delta <= 20, (
        f"Expected ~1 tick/sec (a few ticks over 6s); observed {delta} new ticks."
    )

    # --- Step 5: min/max correctness and current == latest ---------------- #
    snap_a = snapshot(page_a)
    values = [t["value"] for t in snap_a["ticks"]]
    assert values, "History must contain ticks for min/max verification."
    assert to_int("min-value", snap_a["min"]) == min(values), (
        f"min-value must equal min of history values; widget={snap_a['min']}, min={min(values)}."
    )
    assert to_int("max-value", snap_a["max"]) == max(values), (
        f"max-value must equal max of history values; widget={snap_a['max']}, max={max(values)}."
    )
    top = max(snap_a["ticks"], key=lambda t: t["seq"])
    assert to_int("current-value", snap_a["current"]) == top["value"], (
        f"current-value must equal the latest tick's value; "
        f"current={snap_a['current']}, latest(seq={top['seq']})={top['value']}."
    )

    # --- Step 6: producer is server-side, independent of the starter ------ #
    ctx_a.close()  # close the browser that started the stream
    b_before = max_seq(snapshot(page_b))
    wait_until(
        lambda: max_seq(snapshot(page_b)) > b_before,
        timeout=12.0,
        msg="stream stopped after the initiating client closed (producer not server-side)",
    )

    # --- Step 7: threshold alerts apply to subsequent ticks only ---------- #
    snap_b = snapshot(page_b)
    s_boundary = max_seq(snap_b)
    alerts_before = to_int("alert-count", snap_b["alertCount"])
    assert alerts_before == 0, (
        f"No alerts should exist before a threshold is applied, got {alerts_before}."
    )
    page_b.fill('[data-testid="threshold-input"]', "0")
    page_b.click('[data-testid="apply-threshold"]')

    # Wait until at least 3 new ticks (seq > boundary) have arrived.
    def enough_new():
        s = snapshot(page_b)
        return len([t for t in s["ticks"] if t["seq"] > s_boundary]) >= 3

    wait_until(enough_new, timeout=20.0,
               msg="no new ticks arrived after applying the threshold")

    snap_b = snapshot(page_b)
    new_ticks = [t for t in snap_b["ticks"] if t["seq"] > s_boundary]
    old_ticks = [t for t in snap_b["ticks"] if t["seq"] <= s_boundary]
    assert new_ticks, "Expected ticks emitted after the threshold was applied."
    for t in new_ticks:
        assert t["alert"], (
            f"tick seq {t['seq']} (value {t['value']}>0) emitted after threshold 0 "
            f"must have data-alert=\"true\"."
        )
    for t in old_ticks:
        assert not t["alert"], (
            f"tick seq {t['seq']} was emitted before the threshold and must NOT be an alert."
        )
    alerted = [t for t in snap_b["ticks"] if t["alert"]]
    assert to_int("alert-count", snap_b["alertCount"]) == len(alerted), (
        f"alert-count must equal the number of alert ticks; "
        f"widget={snap_b['alertCount']}, alerted={len(alerted)}."
    )
    assert snap_b["over"], (
        "While the latest value exceeds the threshold, current-value must carry data-over=\"true\"."
    )

    # --- Step 8: stop halts the stream ------------------------------------ #
    page_b.click('[data-testid="stop-stream"]')
    time.sleep(2.0)  # let any in-flight tick settle
    stopped = snapshot(page_b)
    stopped_count = to_int("tick-count", stopped["count"])
    stopped_seq = max_seq(stopped)
    time.sleep(4.0)
    after_stop = snapshot(page_b)
    assert to_int("tick-count", after_stop["count"]) == stopped_count, (
        f"After stop, tick-count must not change: {stopped_count} -> {after_stop['count']}."
    )
    assert max_seq(after_stop) == stopped_seq, (
        f"After stop, no new ticks must appear: max seq {stopped_seq} -> {max_seq(after_stop)}."
    )

    # Capture the persisted state to compare after reload.
    pre_reload = snapshot(page_b)
    pre_map = tick_map(pre_reload)

    # --- Step 9: reload restores history and counts ----------------------- #
    page_b.reload(wait_until="domcontentloaded")
    page_b.wait_for_selector('[data-testid="tick-count"]', timeout=30000)
    wait_until(
        lambda: len(snapshot(page_b)["ticks"]) > 0,
        timeout=20.0,
        msg="history was not restored after reload",
    )
    restored = snapshot(page_b)
    assert to_int("tick-count", restored["count"]) == to_int("tick-count", pre_reload["count"]), (
        f"tick-count must be restored after reload: "
        f"{pre_reload['count']} -> {restored['count']}."
    )
    assert to_int("min-value", restored["min"]) == to_int("min-value", pre_reload["min"]), (
        "min-value must be restored after reload."
    )
    assert to_int("max-value", restored["max"]) == to_int("max-value", pre_reload["max"]), (
        "max-value must be restored after reload."
    )
    assert to_int("alert-count", restored["alertCount"]) == to_int("alert-count", pre_reload["alertCount"]), (
        "alert-count must be restored after reload."
    )
    restored_map = tick_map(restored)
    common = set(pre_map) & set(restored_map)
    assert len(common) >= 3, (
        f"Reload must restore the recent tick history; common seqs={sorted(common)}."
    )
    for s in common:
        assert restored_map[s] == pre_map[s], (
            f"Restored tick seq {s} value changed after reload: "
            f"{pre_map[s]} -> {restored_map[s]}."
        )

    ctx_b.close()
