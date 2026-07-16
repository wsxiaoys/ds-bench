import os
import socket
import subprocess

import pytest
import requests
from playwright.sync_api import sync_playwright
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/settings-manager"
PORT = 4173
# Bind/connect over IPv4 explicitly. On Node 17+ `localhost` can resolve to the
# IPv6 loopback (::1), so the preview server would listen on ::1 only while an
# AF_INET socket to 127.0.0.1 never connects -> the readiness check would hang.
HOST = "127.0.0.1"
BASE_URL = f"http://{HOST}:{PORT}"


@pytest.fixture(scope="session")
def start_app(xprocess):
    """Install deps, build the web app, then serve the built assets with
    `vite preview` so the Preferences web/localStorage implementation runs in a
    real browser context."""
    install = subprocess.run(
        ["npm", "install"], cwd=PROJECT_DIR, capture_output=True, text=True
    )
    assert install.returncode == 0, f"npm install failed:\n{install.stdout}\n{install.stderr}"

    build = subprocess.run(
        ["npm", "run", "build"], cwd=PROJECT_DIR, capture_output=True, text=True
    )
    assert build.returncode == 0, f"npm run build failed:\n{build.stdout}\n{build.stderr}"

    class Starter(ProcessStarter):
        name = "settings_preview"
        # `--host 127.0.0.1` forces the preview server onto the IPv4 loopback so
        # it matches the address the readiness check and Playwright connect to.
        args = ["npm", "run", "preview", "--", "--port", str(PORT), "--host", HOST]
        # CRITICAL: set `env` as a class attribute here, NEVER inside `popen_kwargs`.
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
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
    printed_log_lines = 0

    def capture_logs(tag):
        nonlocal printed_log_lines
        with open(info.logpath, "r") as f:
            all_lines = f.readlines()
        new_lines = all_lines[printed_log_lines:]
        skipped = printed_log_lines
        printed_log_lines = len(all_lines)
        print(f"===================== [{tag}: Begin] {Starter.name} logfile =====================")
        if skipped > 0:
            print(f"(skipped {skipped} already-printed lines)")
        print("".join(new_lines))
        print(f"===================== [{tag}: End  ] {Starter.name} logfile =====================")

    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield

    capture_logs("TEARDOWN")
    info.terminate()


@pytest.fixture(scope="session")
def page(start_app):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        pg = context.new_page()
        pg.goto(BASE_URL, wait_until="load")
        yield pg
        browser.close()


@pytest.fixture()
def fresh(page):
    """Return a callable that resets storage to a clean, defaults-only state and
    returns a page whose `window.settings` API is ready."""

    def _fresh():
        page.goto(BASE_URL, wait_until="load")
        page.evaluate("() => window.localStorage.clear()")
        page.reload(wait_until="load")
        page.wait_for_function(
            "() => !!(window.settings "
            "&& typeof window.settings.get === 'function' "
            "&& typeof window.settings.set === 'function' "
            "&& typeof window.settings.reset === 'function' "
            "&& typeof window.settings.keys === 'function' "
            "&& typeof window.settings.exportNamespace === 'function' "
            "&& typeof window.settings.importNamespace === 'function')",
            timeout=15000,
        )
        return page

    return _fresh


def test_typed_defaults(fresh):
    p = fresh()
    result = p.evaluate(
        """async () => {
            const fontSize = await window.settings.get('app', 'fontSize');
            const notifications = await window.settings.get('app', 'notifications');
            const apTheme = await window.settings.get('appearance', 'theme');
            const wordWrap = await window.settings.get('editor', 'wordWrap');
            return {
                fontSize, fontSizeType: typeof fontSize,
                notifications, notificationsType: typeof notifications,
                apTheme,
                wordWrap, wordWrapType: typeof wordWrap,
            };
        }"""
    )
    assert result["fontSize"] == 14 and result["fontSizeType"] == "number", (
        f"app.fontSize default should be number 14, got {result['fontSize']!r} ({result['fontSizeType']})"
    )
    assert result["notifications"] is True and result["notificationsType"] == "boolean", (
        f"app.notifications default should be boolean true, got {result['notifications']!r}"
    )
    assert result["apTheme"] == "system", (
        f"appearance.theme default should be 'system', got {result['apTheme']!r}"
    )
    assert result["wordWrap"] is False and result["wordWrapType"] == "boolean", (
        f"editor.wordWrap default should be boolean false, got {result['wordWrap']!r}"
    )


def test_set_and_typed_get(fresh):
    p = fresh()
    result = p.evaluate(
        """async () => {
            await window.settings.set('app', 'theme', 'dark');
            await window.settings.set('editor', 'tabSize', 8);
            const theme = await window.settings.get('app', 'theme');
            const tabSize = await window.settings.get('editor', 'tabSize');
            return { theme, tabSize, tabSizeType: typeof tabSize };
        }"""
    )
    assert result["theme"] == "dark", f"Expected app.theme 'dark', got {result['theme']!r}"
    assert result["tabSize"] == 8 and result["tabSizeType"] == "number", (
        f"Expected editor.tabSize number 8, got {result['tabSize']!r} ({result['tabSizeType']})"
    )


def test_real_preferences_persistence(fresh):
    p = fresh()
    keys = p.evaluate(
        """async () => {
            await window.settings.set('app', 'theme', 'dark');
            await window.settings.set('editor', 'tabSize', 8);
            return Object.keys(window.localStorage);
        }"""
    )
    assert any(k.startswith("CapacitorStorage.") for k in keys), (
        "Expected at least one localStorage key prefixed with 'CapacitorStorage.' "
        f"(proving the @capacitor/preferences web plugin is used). Got: {keys}"
    )


def test_keys_namespace(fresh):
    p = fresh()
    result = p.evaluate(
        """async () => {
            const emptyBefore = await window.settings.keys('app');
            await window.settings.set('app', 'theme', 'dark');
            await window.settings.set('app', 'fontSize', 18);
            const appKeys = await window.settings.keys('app');
            const editorKeys = await window.settings.keys('editor');
            return { emptyBefore, appKeys, editorKeys };
        }"""
    )
    assert result["emptyBefore"] == [], (
        f"keys('app') should be [] before any set, got {result['emptyBefore']!r}"
    )
    assert result["appKeys"] == ["fontSize", "theme"], (
        f"keys('app') should be ['fontSize', 'theme'] sorted, got {result['appKeys']!r}"
    )
    assert result["editorKeys"] == [], (
        f"keys('editor') should remain [] for an untouched namespace, got {result['editorKeys']!r}"
    )


def test_reset_isolation(fresh):
    p = fresh()
    result = p.evaluate(
        """async () => {
            await window.settings.set('app', 'theme', 'dark');
            await window.settings.set('appearance', 'theme', 'ocean');
            await window.settings.set('appearance', 'accent', 'red');
            await window.settings.reset('app');
            return {
                appTheme: await window.settings.get('app', 'theme'),
                appKeys: await window.settings.keys('app'),
                appearanceTheme: await window.settings.get('appearance', 'theme'),
                appearanceAccent: await window.settings.get('appearance', 'accent'),
                appearanceKeys: await window.settings.keys('appearance'),
            };
        }"""
    )
    assert result["appTheme"] == "light", (
        f"After reset('app'), app.theme should fall back to default 'light', got {result['appTheme']!r}"
    )
    assert result["appKeys"] == [], (
        f"After reset('app'), keys('app') should be [], got {result['appKeys']!r}"
    )
    assert result["appearanceTheme"] == "ocean", (
        "reset('app') must not affect the 'appearance' namespace (prefix isolation); "
        f"appearance.theme should still be 'ocean', got {result['appearanceTheme']!r}"
    )
    assert result["appearanceAccent"] == "red", (
        f"appearance.accent should still be 'red' after reset('app'), got {result['appearanceAccent']!r}"
    )
    assert result["appearanceKeys"] == ["accent", "theme"], (
        f"keys('appearance') should be ['accent', 'theme'] after reset('app'), got {result['appearanceKeys']!r}"
    )


def test_export_merges_defaults(fresh):
    p = fresh()
    result = p.evaluate(
        """async () => {
            await window.settings.set('app', 'theme', 'dark');
            return await window.settings.exportNamespace('app');
        }"""
    )
    assert result == {"theme": "dark", "fontSize": 14, "notifications": True}, (
        "exportNamespace('app') should merge defaults with overrides -> "
        f"{{'theme': 'dark', 'fontSize': 14, 'notifications': True}}, got {result!r}"
    )


def test_import_roundtrip(fresh):
    p = fresh()
    result = p.evaluate(
        """async () => {
            await window.settings.importNamespace('editor', { tabSize: 8, wordWrap: true });
            const tabSize = await window.settings.get('editor', 'tabSize');
            const wordWrap = await window.settings.get('editor', 'wordWrap');
            const exported = await window.settings.exportNamespace('editor');
            await window.settings.importNamespace('editor', { tabSize: 2, unknownKey: 99 });
            const afterUnknown = await window.settings.exportNamespace('editor');
            return {
                tabSize, tabSizeType: typeof tabSize,
                wordWrap, wordWrapType: typeof wordWrap,
                exported, afterUnknown,
            };
        }"""
    )
    assert result["tabSize"] == 8 and result["tabSizeType"] == "number", (
        f"After import, editor.tabSize should be number 8, got {result['tabSize']!r}"
    )
    assert result["wordWrap"] is True and result["wordWrapType"] == "boolean", (
        f"After import, editor.wordWrap should be boolean true, got {result['wordWrap']!r}"
    )
    assert result["exported"] == {"tabSize": 8, "wordWrap": True}, (
        f"exportNamespace('editor') should be {{'tabSize': 8, 'wordWrap': True}}, got {result['exported']!r}"
    )
    assert result["afterUnknown"] == {"tabSize": 2, "wordWrap": True}, (
        "Importing an unknown key must be ignored; expected {'tabSize': 2, 'wordWrap': True}, "
        f"got {result['afterUnknown']!r}"
    )


def test_invalid_rejected(fresh):
    p = fresh()
    result = p.evaluate(
        """async () => {
            async function rejects(fn) {
                try { await fn(); return false; } catch (e) { return true; }
            }
            return {
                unknownNamespace: await rejects(() => window.settings.get('nope', 'theme')),
                unknownKey: await rejects(() => window.settings.get('app', 'unknownKey')),
                setUnknownKey: await rejects(() => window.settings.set('app', 'unknownKey', 1)),
            };
        }"""
    )
    assert result["unknownNamespace"] is True, (
        "get() with an unknown namespace should reject/throw"
    )
    assert result["unknownKey"] is True, (
        "get() with an unknown key should reject/throw"
    )
    assert result["setUnknownKey"] is True, (
        "set() with an unknown key should reject/throw"
    )
