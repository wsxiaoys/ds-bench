import os
import socket
import subprocess

import pytest
import requests
from xprocess import ProcessStarter
from playwright.sync_api import sync_playwright

PROJECT_DIR = "/home/user/toast-queue"
PORT = 4173
# Bind/connect over IPv4 explicitly. On Node 17+ `localhost` can resolve to the
# IPv6 loopback (::1), so the preview server would listen on ::1 only while an
# AF_INET socket to 127.0.0.1 never connects -> the readiness check would hang.
HOST = "127.0.0.1"
BASE_URL = f"http://{HOST}:{PORT}"

READY_FN = (
    "() => typeof window.enqueueToast === 'function'"
    " && typeof window.drainToastQueue === 'function'"
    " && typeof window.getQueueState === 'function'"
)


@pytest.fixture(scope="session")
def start_app(xprocess):
    """Install deps, build the app, then serve the production build via `vite preview`."""
    install = subprocess.run(
        ["npm", "install"], cwd=PROJECT_DIR, capture_output=True, text=True
    )
    assert install.returncode == 0, f"`npm install` failed:\n{install.stdout}\n{install.stderr}"

    build = subprocess.run(
        ["npm", "run", "build"], cwd=PROJECT_DIR, capture_output=True, text=True
    )
    assert build.returncode == 0, f"`npm run build` failed:\n{build.stdout}\n{build.stderr}"

    class Starter(ProcessStarter):
        name = "toast_preview"
        args = ["npm", "run", "preview", "--", "--host", HOST, "--port", str(PORT)]
        env = os.environ.copy()
        popen_kwargs = {"cwd": PROJECT_DIR, "text": True}
        timeout = 180
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex((HOST, PORT)) != 0:
                    return False
            try:
                resp = requests.get(BASE_URL, timeout=20)
                return resp.status_code < 500
            except requests.RequestException:
                return False

    info = xprocess.getinfo(Starter.name)
    printed = 0

    def capture_logs(tag):
        nonlocal printed
        with open(info.logpath, "r") as f:
            lines = f.readlines()
        new_lines = lines[printed:]
        printed = len(lines)
        print(f"===== [{tag}] {Starter.name} log begin =====")
        print("".join(new_lines))
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
        b = p.chromium.launch()
        yield b
        b.close()


@pytest.fixture()
def page(browser):
    context = browser.new_context()
    pg = context.new_page()
    pg.goto(BASE_URL, wait_until="load")
    pg.wait_for_function(READY_FN, timeout=30000)
    yield pg
    context.close()


def test_queue_api_is_exposed(page):
    exposed = page.evaluate(
        "() => ({"
        " enqueue: typeof window.enqueueToast,"
        " drain: typeof window.drainToastQueue,"
        " state: typeof window.getQueueState })"
    )
    assert exposed["enqueue"] == "function", "window.enqueueToast must be a function."
    assert exposed["drain"] == "function", "window.drainToastQueue must be a function."
    assert exposed["state"] == "function", "window.getQueueState must be a function."


BURST_SCRIPT = """
async () => {
  window.__rec = { added: [], removed: [] };
  const isToast = (n) => n && n.nodeType === 1 && n.tagName && n.tagName.toLowerCase() === 'pwa-toast';
  const obs = new MutationObserver((muts) => {
    const t = performance.now();
    for (const m of muts) {
      m.addedNodes.forEach((n) => { if (isToast(n)) window.__rec.added.push({ node: n, at: t }); });
      m.removedNodes.forEach((n) => { if (isToast(n)) window.__rec.removed.push({ node: n, at: t }); });
    }
  });
  obs.observe(document.body, { childList: true, subtree: true });

  const p1 = window.enqueueToast({ text: 'Alpha', duration: 350, position: 'top' });
  const p2 = window.enqueueToast({ text: 'Bravo', duration: 350, position: 'center' });
  const p3 = window.enqueueToast({ text: 'Charlie', duration: 350, position: 'bottom' });
  const p4 = window.enqueueToast({ text: 'Delta', duration: 350, position: 'top' });
  const stateRightAfter = window.getQueueState();

  await window.drainToastQueue();
  await Promise.all([p1, p2, p3, p4]);
  obs.disconnect();

  const added = window.__rec.added.map((a) => {
    const rem = window.__rec.removed.find((r) => r.node === a.node);
    return {
      text: a.node.text,
      position: a.node.getAttribute('data-position'),
      addedAt: a.at,
      removedAt: rem ? rem.at : null,
    };
  });
  return { stateRightAfter, added };
}
"""


@pytest.fixture()
def burst_result(page):
    return page.evaluate(BURST_SCRIPT)


def test_burst_is_queued_not_all_shown_at_once(burst_result):
    state = burst_result["stateRightAfter"]
    # Synchronously after four enqueue calls, most toasts must still be waiting,
    # proving the calls were queued rather than all displayed simultaneously.
    assert (
        state["pending"] >= 2
    ), f"Expected at least 2 toasts queued right after a burst of 4, got state={state}."


def test_burst_count_and_order(burst_result):
    added = burst_result["added"]
    assert len(added) == 4, f"Expected exactly 4 pwa-toast elements, got {len(added)}."
    texts = [a["text"] for a in added]
    assert texts == [
        "Alpha",
        "Bravo",
        "Charlie",
        "Delta",
    ], f"Toasts were not displayed in FIFO enqueue order: {texts}."


def test_burst_never_overlaps(burst_result):
    added = burst_result["added"]
    for i, a in enumerate(added):
        assert a["removedAt"] is not None, f"Toast #{i} ('{a['text']}') was never removed."

    # Consecutive toasts must not overlap: each is removed before the next appears.
    for i in range(len(added) - 1):
        assert added[i]["removedAt"] <= added[i + 1]["addedAt"] + 30, (
            f"Toast '{added[i]['text']}' (removed {added[i]['removedAt']:.1f}ms) overlapped "
            f"with '{added[i + 1]['text']}' (added {added[i + 1]['addedAt']:.1f}ms)."
        )

    # Independent concurrency replay: at most one pwa-toast present at any instant.
    events = []
    for a in added:
        events.append((a["addedAt"], 1))
        events.append((a["removedAt"], 0))
    events.sort(key=lambda e: (e[0], e[1]))  # removals (0) before additions (1) on ties
    current = 0
    peak = 0
    for _, kind in events:
        current += 1 if kind == 1 else -1
        peak = max(peak, current)
    assert peak <= 1, f"More than one toast was present at the same time (peak={peak})."


def test_burst_duration_respected(burst_result):
    added = burst_result["added"]
    for a in added:
        visible = a["removedAt"] - a["addedAt"]
        assert visible >= 250, (
            f"Toast '{a['text']}' was only visible for {visible:.1f}ms, "
            f"expected roughly its 350ms configured duration."
        )


def test_burst_position_plumbed_through(burst_result):
    added = burst_result["added"]
    positions = [a["position"] for a in added]
    assert positions == [
        "top",
        "center",
        "bottom",
        "top",
    ], f"data-position attributes did not match configured positions: {positions}."


def test_enqueue_promise_resolves_after_removal(page):
    result = page.evaluate(
        """
        async () => {
          await window.drainToastQueue();
          await window.enqueueToast({ text: 'Solo', duration: 400 });
          const leftover = document.querySelectorAll('pwa-toast').length;
          const state = window.getQueueState();
          return { leftover, state };
        }
        """
    )
    assert result["leftover"] == 0, (
        "The enqueueToast promise resolved while a pwa-toast element was still in the DOM; "
        "it must resolve only after the toast is removed."
    )
    assert result["state"]["pending"] == 0 and result["state"]["active"] is False, (
        f"Queue should be fully idle after the single toast finished, got {result['state']}."
    )


def test_long_duration_string_mapping(page):
    result = page.evaluate(
        """
        async () => {
          await window.drainToastQueue();
          const p = window.enqueueToast({ text: 'Longy', duration: 'long' });
          const start = performance.now();
          await new Promise((r) => setTimeout(r, 300));
          const midState = window.getQueueState();
          const present = document.querySelectorAll('pwa-toast').length;
          await p;
          const elapsed = performance.now() - start;
          const after = document.querySelectorAll('pwa-toast').length;
          return { midState, present, elapsed, after };
        }
        """
    )
    assert result["midState"]["active"] is True, "Toast should be active shortly after showing a 'long' toast."
    assert result["present"] >= 1, "A pwa-toast element should be present while the 'long' toast is displaying."
    assert result["elapsed"] > 2000, (
        f"'long' duration should map to ~3500ms; toast was only shown for {result['elapsed']:.0f}ms."
    )
    assert result["after"] == 0, "The 'long' toast element should be removed after its duration."


def test_drain_when_idle_resolves_promptly(page):
    elapsed = page.evaluate(
        """
        async () => {
          await window.drainToastQueue();
          const t0 = performance.now();
          await window.drainToastQueue();
          return performance.now() - t0;
        }
        """
    )
    assert elapsed < 500, f"drainToastQueue() on an idle queue should resolve promptly, took {elapsed:.0f}ms."
