import os
import re
import socket
import subprocess
from urllib.parse import urljoin

import pytest
import requests
from playwright.sync_api import expect, sync_playwright
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/project"
PORT = 3000
# Bind/connect over IPv4 explicitly. On Node 17+ `localhost` can resolve to the
# IPv6 loopback (::1), which would make readiness checks hang.
HOST = "127.0.0.1"
BASE_URL = f"http://{HOST}:{PORT}"

SEED_TITLES = ["Set up CI pipeline", "Write onboarding docs"]

MSG_TITLE = "Title must be at least 3 characters"
MSG_DESCRIPTION = "Description must be at least 10 characters"
MSG_PRIORITY = "Priority must be low, medium, or high"


def _console_is_error(msg) -> bool:
    """Return True for genuine console errors, ignoring favicon 404 noise."""
    if msg.type != "error":
        return False
    text = (msg.text or "").lower()
    if "favicon" in text:
        return False
    return True


@pytest.fixture(scope="session")
def build_app():
    """Build the Qwik City production bundle from the (repaired) source."""
    result = subprocess.run(
        ["npm", "run", "build"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=900,
    )
    print("=== npm run build stdout ===")
    print(result.stdout)
    print("=== npm run build stderr ===")
    print(result.stderr)
    assert result.returncode == 0, f"'npm run build' failed:\n{result.stderr}"
    return True


@pytest.fixture(scope="session")
def start_app(xprocess, build_app):
    """Start the production server via `npm run serve` on port 3000."""

    class Starter(ProcessStarter):
        name = "qwik_serve"
        args = ["npm", "run", "serve"]
        env = {**os.environ, "PORT": str(PORT), "HOST": HOST}
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
            all_lines = f.readlines()
        new_lines = all_lines[printed:]
        printed = len(all_lines)
        print(f"===== [{tag}] {Starter.name} log =====")
        print("".join(new_lines))
        print(f"===== [{tag}] end =====")

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


def _fill_form(page, title, priority, description):
    page.fill("[name='title']", title)
    page.select_option("[name='priority']", priority)
    page.fill("[name='description']", description)


# ---------------------------------------------------------------------------
# 1. SSR renders the ticket list on the server (loader), form present.
# ---------------------------------------------------------------------------
def test_ssr_renders_list_and_form(start_app):
    resp = requests.get(BASE_URL, timeout=30)
    assert resp.status_code == 200, f"GET / returned {resp.status_code}"
    html = resp.text
    for title in SEED_TITLES:
        assert title in html, f"Seeded ticket '{title}' missing from server-rendered HTML."
    for field in ["title", "priority", "description"]:
        assert re.search(rf'name=["\']{field}["\']', html), (
            f"Form control name='{field}' not found in server-rendered HTML."
        )
    assert "Create ticket" in html, "Idle submit label 'Create ticket' missing from SSR HTML."


# ---------------------------------------------------------------------------
# 2. No-JS successful submit -> native full-page POST creates the ticket.
# ---------------------------------------------------------------------------
def test_nojs_success_creates_ticket(browser):
    context = browser.new_context(java_script_enabled=False)
    page = context.new_page()
    try:
        page.goto(BASE_URL, wait_until="load")
        _fill_form(
            page,
            "Fix login redirect",
            "high",
            "Users bounce back to the login page after signing in",
        )
        with page.expect_navigation(wait_until="load"):
            page.click("button[type='submit']")
        body_text = page.locator("body").inner_text()
        assert "Ticket created: Fix login redirect" in body_text, (
            "No-JS success did not render the confirmation 'Ticket created: Fix login redirect'."
        )
        assert "Fix login redirect" in body_text, (
            "New ticket not present in list after no-JS submit."
        )
    finally:
        context.close()


# ---------------------------------------------------------------------------
# 3. No-JS rejected submit -> messages shown AND entered values preserved.
# ---------------------------------------------------------------------------
def test_nojs_failure_shows_errors_and_preserves_values(browser):
    context = browser.new_context(java_script_enabled=False)
    page = context.new_page()
    try:
        page.goto(BASE_URL, wait_until="load")
        _fill_form(page, "Hi", "medium", "too short")
        with page.expect_navigation(wait_until="load"):
            page.click("button[type='submit']")
        body_text = page.locator("body").inner_text()
        assert MSG_TITLE in body_text, "No-JS failure did not render the title validation message."
        assert MSG_DESCRIPTION in body_text, (
            "No-JS failure did not render the description validation message."
        )
        assert page.input_value("[name='title']") == "Hi", (
            "No-JS failure did not preserve the 'title' value."
        )
        assert page.input_value("[name='description']") == "too short", (
            "No-JS failure did not preserve the 'description' value."
        )
        assert page.input_value("[name='priority']") == "medium", (
            "No-JS failure did not preserve the selected 'priority' value."
        )
        assert "Ticket created:" not in body_text, (
            "A ticket was created despite invalid no-JS submission."
        )
    finally:
        context.close()


# ---------------------------------------------------------------------------
# 4. JS-enhanced success -> no navigation, running state, list updates.
# ---------------------------------------------------------------------------
def test_js_success_updates_in_place_with_running_state(browser):
    context = browser.new_context(java_script_enabled=True)
    page = context.new_page()
    errors = []
    page.on("console", lambda m: errors.append(m.text) if _console_is_error(m) else None)
    try:
        page.goto(BASE_URL, wait_until="networkidle")
        assert not errors, f"Console errors on initial load: {errors}"

        page.evaluate("window.__noReload = true")
        _fill_form(
            page,
            "Add dark mode",
            "low",
            "Provide a dark theme toggle in settings",
        )

        submit = page.locator("button[type='submit']")
        submit.click()

        # In-flight running state (action has a ~1s delay).
        expect(submit).to_contain_text("Submitting...", timeout=4000)
        expect(submit).to_be_disabled(timeout=4000)

        # Completion.
        expect(page.locator("body")).to_contain_text(
            "Ticket created: Add dark mode", timeout=15000
        )
        assert page.evaluate("() => window.__noReload") is True, (
            "A full-page navigation occurred on JS-enhanced submit (sentinel lost)."
        )
        expect(page.locator("body")).to_contain_text("Add dark mode")
        expect(submit).to_contain_text("Create ticket", timeout=5000)
        expect(submit).to_be_enabled(timeout=5000)
    finally:
        context.close()


# ---------------------------------------------------------------------------
# 5. JS-enhanced rejected submit -> errors, values preserved, no navigation.
# ---------------------------------------------------------------------------
def test_js_failure_shows_errors_without_navigation(browser):
    context = browser.new_context(java_script_enabled=True)
    page = context.new_page()
    try:
        page.goto(BASE_URL, wait_until="networkidle")
        page.evaluate("window.__noReload = true")
        _fill_form(page, "ok", "high", "nope")

        page.locator("button[type='submit']").click()

        expect(page.locator("body")).to_contain_text(MSG_TITLE, timeout=15000)
        expect(page.locator("body")).to_contain_text(MSG_DESCRIPTION, timeout=5000)
        assert page.evaluate("() => window.__noReload") is True, (
            "A full-page navigation occurred on rejected JS-enhanced submit (sentinel lost)."
        )
        assert page.input_value("[name='title']") == "ok", (
            "JS failure did not preserve the 'title' value."
        )
        assert page.input_value("[name='description']") == "nope", (
            "JS failure did not preserve the 'description' value."
        )
        assert page.input_value("[name='priority']") == "high", (
            "JS failure did not preserve the selected 'priority' value."
        )
        assert "Ticket created:" not in page.locator("body").inner_text(), (
            "A ticket was created despite invalid JS submission."
        )
    finally:
        context.close()


# ---------------------------------------------------------------------------
# 6. Server-side priority enum validation (anti-cheat: not UI-only).
# ---------------------------------------------------------------------------
def test_server_side_priority_validation(start_app):
    html = requests.get(BASE_URL, timeout=30).text
    m = re.search(r'<form[^>]*\baction=["\']([^"\']+)["\']', html)
    assert m, "Could not find the create <form> action attribute in the page HTML."
    action_url = urljoin(BASE_URL, m.group(1))

    resp = requests.post(
        action_url,
        data={
            "title": "Valid title",
            "priority": "urgent",
            "description": "this description is long enough",
        },
        headers={"Origin": BASE_URL},
        timeout=30,
    )
    assert MSG_PRIORITY in resp.text, (
        "Server did not reject an out-of-range 'priority' value with the required message."
    )

    fresh = requests.get(BASE_URL, timeout=30).text
    assert "Valid title" not in fresh, (
        "A ticket was created despite an invalid 'priority' value (server did not enforce the enum)."
    )
