import asyncio
import os
import re
import signal
import socket
import subprocess
import tempfile
import time

import pytest
import requests
from playwright.async_api import async_playwright, expect

PROJECT_DIR = "/home/user/app"
PORT = 34517
# Always use the IPv4 loopback explicitly: on Node 17+ `localhost` may resolve to
# the IPv6 loopback (::1) while the server binds 127.0.0.1, which would make the
# readiness probe hang for the full timeout.
HOST = "127.0.0.1"
BASE_URL = f"http://{HOST}:{PORT}"
DB_PATH = os.path.join(PROJECT_DIR, "data", "app.db")

# ---------------------------------------------------------------------------
# Server lifecycle helpers
# ---------------------------------------------------------------------------


def _port_open() -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(1)
        return s.connect_ex((HOST, PORT)) == 0


def _wait_for_ready(timeout: float = 120.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if _port_open():
            try:
                resp = requests.get(BASE_URL, timeout=10)
                if resp.status_code < 500:
                    return True
            except requests.RequestException:
                pass
        time.sleep(0.5)
    return False


def _wait_for_free(timeout: float = 30.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if not _port_open():
            return True
        time.sleep(0.5)
    return False


def _read_log(path: str) -> str:
    try:
        with open(path, "r") as f:
            return f.read()
    except OSError:
        return "<no log captured>"


def _start_server():
    """Start `npm start` on PORT in its own process group; wait until ready."""
    env = os.environ.copy()
    env["PORT"] = str(PORT)
    log_file = tempfile.NamedTemporaryFile(
        prefix="app_server_", suffix=".log", delete=False
    )
    log_path = log_file.name
    proc = subprocess.Popen(
        ["npm", "start"],
        cwd=PROJECT_DIR,
        env=env,
        stdout=log_file,
        stderr=subprocess.STDOUT,
        text=True,
        start_new_session=True,
    )
    if not _wait_for_ready():
        logs = _read_log(log_path)
        _stop_server(proc)
        raise AssertionError(
            f"Server did not become ready on {BASE_URL} within timeout.\n"
            f"--- server log ---\n{logs}"
        )
    return proc, log_path


def _stop_server(proc) -> None:
    if proc is None:
        return
    try:
        os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
    except (ProcessLookupError, PermissionError):
        try:
            proc.terminate()
        except Exception:
            pass
    try:
        proc.wait(timeout=20)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
        except Exception:
            pass
        try:
            proc.wait(timeout=10)
        except Exception:
            pass
    _wait_for_free()


# ---------------------------------------------------------------------------
# Small assertion helpers
# ---------------------------------------------------------------------------


async def _first_int(page, testid: str):
    text = await page.get_by_test_id(testid).inner_text()
    nums = re.findall(r"-?\d+", text)
    return int(nums[0]) if nums else None


async def _wait_int(page, testid: str, expected: int, timeout: float = 12.0):
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        try:
            last = await _first_int(page, testid)
        except Exception:
            last = None
        if last == expected:
            return
        await asyncio.sleep(0.25)
    raise AssertionError(
        f"Expected `{testid}` to report {expected}, but last observed value was {last}."
    )


# ---------------------------------------------------------------------------
# Build fixture (runs once, with a clean seed)
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def built_app():
    # Remove any pre-existing database so the first server start seeds the known
    # 57-item dataset deterministically.
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    result = subprocess.run(
        ["npm", "run", "build"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=900,
    )
    assert result.returncode == 0, (
        "`npm run build` failed.\n--- stdout ---\n"
        f"{result.stdout}\n--- stderr ---\n{result.stderr}"
    )
    return True


# ---------------------------------------------------------------------------
# The full end-to-end verification
# ---------------------------------------------------------------------------


def test_full_flow(built_app):
    server = {"proc": None, "log": None}
    server["proc"], server["log"] = _start_server()
    try:
        _verify_initial_api()
        asyncio.run(_browser_flow(server))
        _verify_api_after_archive()
    finally:
        if server["log"]:
            print("--- final server log ---")
            print(_read_log(server["log"]))
        _stop_server(server["proc"])


def _verify_initial_api():
    # truth step 1: pagination shape on the freshly seeded dataset.
    resp = requests.get(
        f"{BASE_URL}/api/items",
        params={"status": "active", "page": 1, "pageSize": 10},
        timeout=15,
    )
    assert resp.status_code == 200, f"GET /api/items page 1 returned {resp.status_code}."
    data = resp.json()
    assert data.get("total") == 57, f"Expected total 57 active items, got {data.get('total')}."
    assert data.get("page") == 1, f"Expected page 1, got {data.get('page')}."
    assert data.get("pageSize") == 10, f"Expected pageSize 10, got {data.get('pageSize')}."
    rows = data.get("rows")
    assert isinstance(rows, list) and len(rows) == 10, (
        f"Expected 10 rows on page 1, got {rows if not isinstance(rows, list) else len(rows)}."
    )
    first = rows[0]
    assert first.get("id") == 1, f"Expected first row id 1, got {first.get('id')}."
    assert first.get("name") == "Item 0001", f"Expected name 'Item 0001', got {first.get('name')}."
    assert first.get("category") == "Alpha", f"Expected category 'Alpha', got {first.get('category')}."
    assert first.get("status") == "active", f"Expected status 'active', got {first.get('status')}."

    resp6 = requests.get(
        f"{BASE_URL}/api/items",
        params={"status": "active", "page": 6, "pageSize": 10},
        timeout=15,
    )
    assert resp6.status_code == 200, f"GET /api/items page 6 returned {resp6.status_code}."
    data6 = resp6.json()
    rows6 = data6.get("rows")
    assert isinstance(rows6, list) and len(rows6) == 7, (
        f"Expected 7 rows on the last page, got {rows6 if not isinstance(rows6, list) else len(rows6)}."
    )
    ids6 = sorted(r.get("id") for r in rows6)
    assert ids6 == list(range(51, 58)), f"Expected last page ids 51..57, got {ids6}."


async def _browser_flow(server):
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        context = await browser.new_context()
        page = await context.new_page()
        page.set_default_timeout(20000)
        try:
            await page.goto(BASE_URL, wait_until="networkidle")

            # --- truth step 2: cross-page manual selection count ---
            await expect(page.get_by_test_id("row-1")).to_be_visible()
            await page.get_by_test_id("row-checkbox-1").check()
            await page.get_by_test_id("row-checkbox-2").check()
            await page.get_by_test_id("row-checkbox-3").check()
            await _wait_int(page, "selection-count", 3)

            await page.get_by_test_id("next-page").click()
            await expect(page.get_by_test_id("row-11")).to_be_visible()
            await page.get_by_test_id("row-checkbox-11").check()
            await page.get_by_test_id("row-checkbox-12").check()
            await _wait_int(page, "selection-count", 5)

            # --- truth step 3: selection persists across pages ---
            await page.get_by_test_id("prev-page").click()
            await expect(page.get_by_test_id("row-1")).to_be_visible()
            await expect(page.get_by_test_id("row-checkbox-1")).to_be_checked()
            await expect(page.get_by_test_id("row-checkbox-2")).to_be_checked()
            await expect(page.get_by_test_id("row-checkbox-3")).to_be_checked()
            await _wait_int(page, "selection-count", 5)

            # --- truth step 4: clear selection ---
            await page.get_by_test_id("clear-selection").click()
            await _wait_int(page, "selection-count", 0)
            await expect(page.get_by_test_id("bulk-archive")).to_be_disabled()

            # --- truth step 5: select-all-matching across every page ---
            await page.get_by_test_id("select-page-checkbox").check()
            await expect(page.get_by_test_id("select-all-matching")).to_be_enabled()
            await page.get_by_test_id("select-all-matching").click()
            await _wait_int(page, "selection-count", 57)
            assert await _first_int(page, "total-count") == 57, (
                "total-count should report 57 items in the active filter."
            )

            # --- truth step 6: optimistic bulk archive (delayed network) ---
            async def _delayed(route):
                await asyncio.sleep(1.5)
                await route.continue_()

            await page.route("**/api/items/bulk-archive", _delayed)
            await page.get_by_test_id("bulk-archive").click()
            # Before the delayed response can return (well under 1500 ms), the
            # optimistic update must already have emptied the active view.
            await expect(page.get_by_test_id("row-1")).to_have_count(0, timeout=1200)
            await expect(page.get_by_test_id("empty-state")).to_be_visible(timeout=1200)

            # Let the request settle, then verify the post-settle state.
            await asyncio.sleep(2.5)
            await page.unroute("**/api/items/bulk-archive")
            await _wait_int(page, "total-count", 0)
            await _wait_int(page, "selection-count", 0)

            # --- truth step 7: durable persistence across a server restart ---
            _stop_server(server["proc"])
            server["proc"], server["log"] = _start_server()

            await page.goto(BASE_URL, wait_until="networkidle")
            await _wait_int(page, "total-count", 0)
            await expect(page.get_by_test_id("empty-state")).to_be_visible()
            await _wait_int(page, "selection-count", 0)

            await page.get_by_test_id("filter-archived").click()
            await _wait_int(page, "total-count", 57)
            await expect(page.get_by_test_id("row-1")).to_be_visible()
        finally:
            await context.close()
            await browser.close()


def _verify_api_after_archive():
    # truth step 8: server-side all-mode integrity (every matching row archived).
    active = requests.get(
        f"{BASE_URL}/api/items",
        params={"status": "active", "page": 1, "pageSize": 10},
        timeout=15,
    )
    assert active.status_code == 200, f"GET active returned {active.status_code}."
    assert active.json().get("total") == 0, (
        f"Expected 0 active items after archiving all, got {active.json().get('total')}."
    )

    archived = requests.get(
        f"{BASE_URL}/api/items",
        params={"status": "archived", "page": 1, "pageSize": 10},
        timeout=15,
    )
    assert archived.status_code == 200, f"GET archived returned {archived.status_code}."
    assert archived.json().get("total") == 57, (
        f"Expected 57 archived items after archiving all, got {archived.json().get('total')}."
    )
