import os
import json
import socket
import subprocess

import pytest
from xprocess import ProcessStarter
from playwright.sync_api import sync_playwright

PROJECT_DIR = "/home/user/app"
# Bind/connect over IPv4 explicitly. On Node 17+ `localhost` can resolve to the
# IPv6 loopback (::1); forcing 127.0.0.1 keeps the preview server and the
# browser client on the same address.
HOST = "127.0.0.1"
PORT = 4173
BASE_URL = f"http://{HOST}:{PORT}"


# ---------------------------------------------------------------------------
# A. Static configuration checks (CLI): evaluate capacitor.config.ts
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def keyboard_config():
    """Transpile and evaluate capacitor.config.ts with tsx to read the real
    JavaScript value of config.plugins.Keyboard (works whether the executor
    used the KeyboardResize/KeyboardStyle enums or raw string values)."""
    evaluator_path = os.path.join(PROJECT_DIR, "__eval_keyboard_config.ts")
    code = (
        "import config from './capacitor.config.ts';\n"
        "const kb = (config as any).plugins?.Keyboard ?? null;\n"
        "console.log('KEYBOARD_JSON:' + JSON.stringify(kb));\n"
    )
    with open(evaluator_path, "w") as f:
        f.write(code)
    try:
        result = subprocess.run(
            ["tsx", "__eval_keyboard_config.ts"],
            capture_output=True,
            text=True,
            cwd=PROJECT_DIR,
            timeout=120,
        )
    finally:
        if os.path.exists(evaluator_path):
            os.remove(evaluator_path)

    assert result.returncode == 0, (
        "Failed to evaluate capacitor.config.ts with tsx. "
        f"stdout={result.stdout!r} stderr={result.stderr!r}"
    )

    payload = None
    for line in result.stdout.splitlines():
        if line.startswith("KEYBOARD_JSON:"):
            payload = line[len("KEYBOARD_JSON:"):]
            break
    assert payload is not None, (
        f"Could not find evaluated Keyboard config in output: {result.stdout!r}"
    )
    kb = json.loads(payload)
    assert isinstance(kb, dict), (
        "capacitor.config.ts does not export a plugins.Keyboard configuration object; "
        f"evaluated value was: {kb!r}"
    )
    return kb


def test_keyboard_config_resize_is_body(keyboard_config):
    assert str(keyboard_config.get("resize")).lower() == "body", (
        "Expected plugins.Keyboard.resize to resolve to 'body' "
        f"(KeyboardResize.Body), got: {keyboard_config.get('resize')!r}"
    )


def test_keyboard_config_style_is_dark(keyboard_config):
    assert str(keyboard_config.get("style")).upper() == "DARK", (
        "Expected plugins.Keyboard.style to resolve to 'DARK' "
        f"(KeyboardStyle.Dark), got: {keyboard_config.get('style')!r}"
    )


def test_keyboard_config_resize_on_full_screen_enabled(keyboard_config):
    assert keyboard_config.get("resizeOnFullScreen") is True, (
        "Expected plugins.Keyboard.resizeOnFullScreen to be boolean true, "
        f"got: {keyboard_config.get('resizeOnFullScreen')!r}"
    )


# ---------------------------------------------------------------------------
# B. Listener / handler logic checks (headless browser)
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def built_app():
    """Build the web app; verification loads the built output in a browser."""
    result = subprocess.run(
        ["npm", "run", "build"],
        capture_output=True,
        text=True,
        cwd=PROJECT_DIR,
        timeout=300,
    )
    print("=== npm run build stdout ===")
    print(result.stdout)
    print("=== npm run build stderr ===")
    print(result.stderr)
    assert result.returncode == 0, f"'npm run build' failed: {result.stderr}"
    dist_index = os.path.join(PROJECT_DIR, "dist", "index.html")
    assert os.path.isfile(dist_index), (
        f"Expected build output {dist_index} to exist after 'npm run build'."
    )
    return PROJECT_DIR


@pytest.fixture(scope="session")
def preview_server(xprocess, built_app):
    """Serve the built dist/ directory with `vite preview`."""

    class Starter(ProcessStarter):
        name = "preview_server"
        args = [
            "npx", "vite", "preview",
            "--host", HOST,
            "--port", str(PORT),
            "--strictPort",
        ]
        env = os.environ.copy()
        popen_kwargs = {"cwd": PROJECT_DIR, "text": True}
        timeout = 120
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                return s.connect_ex((HOST, PORT)) == 0

    info = xprocess.getinfo(Starter.name)
    printed = 0

    def capture_logs(tag):
        nonlocal printed
        with open(info.logpath, "r") as f:
            lines = f.readlines()
        new_lines = lines[printed:]
        printed = len(lines)
        print(f"===== [{tag}] preview_server log =====")
        print("".join(new_lines))
        print(f"===== [{tag}] end log =====")

    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield BASE_URL

    capture_logs("TEARDOWN")
    info.terminate()


def _read_offset(page):
    return page.evaluate(
        "getComputedStyle(document.documentElement)"
        ".getPropertyValue('--keyboard-offset').trim()"
    )


def _has_open_class(page):
    return page.evaluate("document.body.classList.contains('keyboard-open')")


def test_browser_keyboard_layout(preview_server):
    """Drive the keyboard show/hide window events and verify the CSS variable
    and body class react correctly and read the height dynamically."""
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        try:
            page.goto(preview_server, wait_until="networkidle")
            page.wait_for_timeout(300)

            # 1. Initial state
            assert _read_offset(page) == "0px", (
                "Expected --keyboard-offset to be '0px' before any keyboard event, "
                f"got: {_read_offset(page)!r}"
            )
            assert _has_open_class(page) is False, (
                "Expected document.body NOT to have 'keyboard-open' initially."
            )

            # 2. keyboardWillShow with height 250
            page.evaluate(
                "() => { const e = new Event('keyboardWillShow');"
                " e.keyboardHeight = 250; window.dispatchEvent(e); }"
            )
            page.wait_for_timeout(150)
            assert _read_offset(page) == "250px", (
                "After keyboardWillShow(250), expected --keyboard-offset '250px', "
                f"got: {_read_offset(page)!r}"
            )
            assert _has_open_class(page) is True, (
                "After keyboardWillShow, expected document.body to have 'keyboard-open'."
            )

            # 3. keyboardWillHide
            page.evaluate(
                "() => { window.dispatchEvent(new Event('keyboardWillHide')); }"
            )
            page.wait_for_timeout(150)
            assert _read_offset(page) == "0px", (
                "After keyboardWillHide, expected --keyboard-offset '0px', "
                f"got: {_read_offset(page)!r}"
            )
            assert _has_open_class(page) is False, (
                "After keyboardWillHide, expected 'keyboard-open' class removed."
            )

            # 4. keyboardWillShow with a DIFFERENT height 336 (dynamic read)
            page.evaluate(
                "() => { const e = new Event('keyboardWillShow');"
                " e.keyboardHeight = 336; window.dispatchEvent(e); }"
            )
            page.wait_for_timeout(150)
            assert _read_offset(page) == "336px", (
                "After keyboardWillShow(336), expected --keyboard-offset '336px' "
                f"(height must be read dynamically), got: {_read_offset(page)!r}"
            )
            assert _has_open_class(page) is True, (
                "After keyboardWillShow(336), expected 'keyboard-open' class present."
            )
        finally:
            browser.close()
