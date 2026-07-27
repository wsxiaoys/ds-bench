import os
import socket
import time
import urllib.request

import pytest
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/project"
PORT = 5173
HOST = "127.0.0.1"
BASE_URL = f"http://{HOST}:{PORT}/notifications"

# Realtime propagation across two independent clients can take a moment.
SYNC_TIMEOUT_MS = 20000

# CSS selector for a rendered notification item. Every item carries data-severity
# per the contract, which cleanly excludes the "notif-list" container.
ITEM_SELECTOR = "[data-testid^='notif-'][data-severity]"
VISIBLE_ITEM_SELECTOR = ITEM_SELECTOR + ":visible"


@pytest.fixture(scope="session")
def start_app(xprocess):
    """Start the RedwoodSDK dev server (Vite + Cloudflare plugin) via xprocess."""

    class Starter(ProcessStarter):
        name = "start_app"
        args = ["npm", "run", "dev", "--", "--host", HOST]
        # CRITICAL: set `env` as a class attribute here, NEVER inside `popen_kwargs`.
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 240
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                return s.connect_ex((HOST, PORT)) == 0

    info = xprocess.getinfo(Starter.name)
    printed_log_lines = 0

    def capture_logs(tag):
        nonlocal printed_log_lines
        try:
            with open(info.logpath, "r") as f:
                all_lines = f.readlines()
        except FileNotFoundError:
            all_lines = []
        new_lines = all_lines[printed_log_lines:]
        skipped = printed_log_lines
        printed_log_lines = len(all_lines)
        print(f"============================== [{tag}: Begin] Captured {Starter.name} logfile ==============================")
        if skipped > 0:
            print(f"(skipped {skipped} already-printed lines)")
        print("".join(new_lines))
        print(f"============================== [{tag}: End  ] Captured {Starter.name} logfile ==============================")

    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield

    capture_logs("TEARDOWN")
    info.terminate()


def _warm_up():
    """Issue requests until the Vite/Cloudflare dev server finishes building /notifications."""
    last_err = None
    for _ in range(60):
        try:
            with urllib.request.urlopen(BASE_URL, timeout=10) as resp:
                if resp.status == 200:
                    return
        except Exception as e:  # noqa: BLE001
            last_err = e
        time.sleep(2)
    raise AssertionError(f"App did not become ready at {BASE_URL}: {last_err}")


def _items(page):
    return page.locator(ITEM_SELECTOR)


def _visible_items(page):
    return page.locator(VISIBLE_ITEM_SELECTOR)


def _unread(page):
    return page.get_by_test_id("unread-count")


def _visible_count(page):
    return page.get_by_test_id("visible-count")


def _notif(page, notif_id):
    # Exact-match locator for a single notification by id.
    return page.locator(f"[data-testid=\"notif-{notif_id}\"]")


def _read_int(locator):
    return int(locator.inner_text().strip())


def _snapshot_items(page):
    """Return a list of (id, severity, read) tuples for all rendered items, in DOM order."""
    loc = _items(page)
    n = loc.count()
    out = []
    for i in range(n):
        el = loc.nth(i)
        tid = el.get_attribute("data-testid") or ""
        assert tid.startswith("notif-"), f"Item data-testid must start with 'notif-', got {tid!r}"
        notif_id = tid[len("notif-"):]
        severity = el.get_attribute("data-severity")
        read = el.get_attribute("data-read")
        out.append((notif_id, severity, read))
    return out


def _severity_counts(triples):
    counts = {"info": 0, "warning": 0, "error": 0}
    for _id, sev, _read in triples:
        assert sev in counts, f"Unexpected data-severity value {sev!r}"
        counts[sev] += 1
    return counts


def test_notification_center(start_app):
    _warm_up()

    from playwright.sync_api import expect, sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            # --- Two independent clients. ---
            context_a = browser.new_context()
            context_b = browser.new_context()
            page_a = context_a.new_page()
            page_b = context_b.new_page()

            page_a.goto(BASE_URL, wait_until="networkidle")
            page_b.goto(BASE_URL, wait_until="networkidle")

            # 1. Page loads and hydrates: all required controls present on both clients.
            for pg, name in ((page_a, "A"), (page_b, "B")):
                expect(pg.get_by_test_id("emit-info")).to_be_visible(timeout=SYNC_TIMEOUT_MS)
                expect(pg.get_by_test_id("emit-warning")).to_be_visible(timeout=SYNC_TIMEOUT_MS)
                expect(pg.get_by_test_id("emit-error")).to_be_visible(timeout=SYNC_TIMEOUT_MS)
                expect(pg.get_by_test_id("notif-list")).to_be_visible(timeout=SYNC_TIMEOUT_MS)
                expect(pg.get_by_test_id("unread-count")).to_be_visible(timeout=SYNC_TIMEOUT_MS)
                expect(pg.get_by_test_id("visible-count")).to_be_visible(timeout=SYNC_TIMEOUT_MS)
                expect(pg.get_by_test_id("read-all")).to_be_visible(timeout=SYNC_TIMEOUT_MS)
                expect(pg.get_by_test_id("filter-all")).to_be_visible(timeout=SYNC_TIMEOUT_MS)
                expect(pg.get_by_test_id("filter-info")).to_be_visible(timeout=SYNC_TIMEOUT_MS)
                expect(pg.get_by_test_id("filter-warning")).to_be_visible(timeout=SYNC_TIMEOUT_MS)
                expect(pg.get_by_test_id("filter-error")).to_be_visible(timeout=SYNC_TIMEOUT_MS)

            # Capture a baseline. The test is written as DELTAS against whatever state
            # already exists so it stays deterministic even if the app persisted
            # notifications to its local database on a previous run.
            page_a.wait_for_timeout(2000)
            baseline = _snapshot_items(page_a)
            baseline_ids = {t[0] for t in baseline}
            baseline_total = len(baseline)
            baseline_by_sev = _severity_counts(baseline)
            baseline_unread = _read_int(_unread(page_a))

            # 2. Live broadcast + unread count. Emit 2 info, 1 warning, 2 error on A.
            emit_sequence = [
                "emit-info",
                "emit-info",
                "emit-warning",
                "emit-error",
                "emit-error",
            ]
            for i, testid in enumerate(emit_sequence, start=1):
                page_a.get_by_test_id(testid).click()
                # Serialize emits: wait until A reflects each new item before the next click.
                expect(_items(page_a)).to_have_count(baseline_total + i, timeout=SYNC_TIMEOUT_MS)

            # Both clients converge on baseline+5 items, live, without reload.
            expect(_items(page_a)).to_have_count(baseline_total + 5, timeout=SYNC_TIMEOUT_MS)
            expect(_items(page_b)).to_have_count(baseline_total + 5, timeout=SYNC_TIMEOUT_MS)

            # Unread badge updates live on BOTH clients.
            expect(_unread(page_a)).to_have_text(str(baseline_unread + 5), timeout=SYNC_TIMEOUT_MS)
            expect(_unread(page_b)).to_have_text(str(baseline_unread + 5), timeout=SYNC_TIMEOUT_MS)

            # Identify the 5 newly created notifications and validate their severities.
            after = _snapshot_items(page_a)
            new_items = [t for t in after if t[0] not in baseline_ids]
            assert len(new_items) == 5, (
                f"Expected exactly 5 newly created notifications, got {len(new_items)}: {new_items}"
            )
            new_by_sev = _severity_counts(new_items)
            assert new_by_sev == {"info": 2, "warning": 1, "error": 2}, (
                f"New notifications severities must be 2 info / 1 warning / 2 error, got {new_by_sev}"
            )
            new_error_ids = [t[0] for t in new_items if t[1] == "error"]
            new_info_ids = [t[0] for t in new_items if t[1] == "info"]
            assert new_info_ids and len(new_error_ids) == 2

            # Newest-first ordering: the first item in the list is the most recent emit (an error).
            first_id, first_sev, _first_read = after[0]
            assert first_sev == "error", f"Newest item should have data-severity 'error', got {first_sev!r}"
            assert first_id in new_error_ids, "Newest item should be one of the just-emitted error notifications."

            # New notifications start unread.
            pick_info_id = new_info_ids[0]
            expect(_notif(page_a, pick_info_id)).to_have_attribute("data-read", "false", timeout=SYNC_TIMEOUT_MS)

            # 3. Filtering is per-client and drives visible-count. Filter on B only.
            page_b.get_by_test_id("filter-error").click()
            expected_error_visible = baseline_by_sev["error"] + 2
            expect(_visible_count(page_b)).to_have_text(str(expected_error_visible), timeout=SYNC_TIMEOUT_MS)
            expect(_visible_items(page_b)).to_have_count(expected_error_visible, timeout=SYNC_TIMEOUT_MS)
            # Every currently-visible item on B is an error item.
            for sev in [t[1] for t in _snapshot_items_visible(page_b)]:
                assert sev == "error", f"Under filter-error only error items may be visible, saw {sev!r}"
            # The just-emitted error notifications are visible; a new info one is hidden.
            for eid in new_error_ids:
                expect(_notif(page_b, eid)).to_be_visible(timeout=SYNC_TIMEOUT_MS)
            expect(_notif(page_b, pick_info_id)).to_be_hidden(timeout=SYNC_TIMEOUT_MS)

            # A is unaffected by B's filter (A still shows everything under its own filter).
            expect(_visible_count(page_a)).to_have_text(str(baseline_total + 5), timeout=SYNC_TIMEOUT_MS)

            # Filter to warning on B.
            page_b.get_by_test_id("filter-warning").click()
            expected_warning_visible = baseline_by_sev["warning"] + 1
            expect(_visible_count(page_b)).to_have_text(str(expected_warning_visible), timeout=SYNC_TIMEOUT_MS)
            expect(_visible_items(page_b)).to_have_count(expected_warning_visible, timeout=SYNC_TIMEOUT_MS)

            # Back to all on B.
            page_b.get_by_test_id("filter-all").click()
            expect(_visible_count(page_b)).to_have_text(str(baseline_total + 5), timeout=SYNC_TIMEOUT_MS)
            expect(_visible_items(page_b)).to_have_count(baseline_total + 5, timeout=SYNC_TIMEOUT_MS)

            # 4. Shared mark-read (A -> B) decrements unread everywhere.
            unread_before_mark = baseline_unread + 5
            page_a.get_by_test_id(f"read-{pick_info_id}").click()
            expect(_notif(page_a, pick_info_id)).to_have_attribute("data-read", "true", timeout=SYNC_TIMEOUT_MS)
            expect(_unread(page_a)).to_have_text(str(unread_before_mark - 1), timeout=SYNC_TIMEOUT_MS)
            # Reflected live on B (shared read-state).
            expect(_notif(page_b, pick_info_id)).to_have_attribute("data-read", "true", timeout=SYNC_TIMEOUT_MS)
            expect(_unread(page_b)).to_have_text(str(unread_before_mark - 1), timeout=SYNC_TIMEOUT_MS)

            # 5. Mark all read zeroes unread everywhere.
            page_b.get_by_test_id("read-all").click()
            expect(_unread(page_b)).to_have_text("0", timeout=SYNC_TIMEOUT_MS)
            expect(_unread(page_a)).to_have_text("0", timeout=SYNC_TIMEOUT_MS)
            for _id, _sev, _read in new_items:
                expect(_notif(page_a, _id)).to_have_attribute("data-read", "true", timeout=SYNC_TIMEOUT_MS)
                expect(_notif(page_b, _id)).to_have_attribute("data-read", "true", timeout=SYNC_TIMEOUT_MS)

            # 6. Persistence across reload.
            page_a.reload(wait_until="networkidle")
            expect(_items(page_a)).to_have_count(baseline_total + 5, timeout=SYNC_TIMEOUT_MS)
            expect(_unread(page_a)).to_have_text("0", timeout=SYNC_TIMEOUT_MS)
            for _id, _sev, _read in new_items:
                expect(_notif(page_a, _id)).to_be_visible(timeout=SYNC_TIMEOUT_MS)
                expect(_notif(page_a, _id)).to_have_attribute("data-read", "true", timeout=SYNC_TIMEOUT_MS)

            # Late joiner: a fresh client that never emitted sees the existing state (server is source of truth).
            context_c = browser.new_context()
            page_c = context_c.new_page()
            page_c.goto(BASE_URL, wait_until="networkidle")
            expect(_items(page_c)).to_have_count(baseline_total + 5, timeout=SYNC_TIMEOUT_MS)
            expect(_unread(page_c)).to_have_text("0", timeout=SYNC_TIMEOUT_MS)
            for _id, _sev, _read in new_items:
                expect(_notif(page_c, _id)).to_have_attribute("data-read", "true", timeout=SYNC_TIMEOUT_MS)
        finally:
            browser.close()


def _snapshot_items_visible(page):
    """Return (id, severity, read) tuples for currently-visible items only."""
    loc = _visible_items(page)
    n = loc.count()
    out = []
    for i in range(n):
        el = loc.nth(i)
        tid = el.get_attribute("data-testid") or ""
        notif_id = tid[len("notif-"):]
        severity = el.get_attribute("data-severity")
        read = el.get_attribute("data-read")
        out.append((notif_id, severity, read))
    return out
