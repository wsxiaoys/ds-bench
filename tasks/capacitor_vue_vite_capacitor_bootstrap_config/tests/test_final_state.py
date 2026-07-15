import json
import os
import re
import socket
import subprocess
import tempfile

import pytest
import requests
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/vue-capacitor-app"
WEB_DIR = os.path.join(PROJECT_DIR, "www")
CONFIG_TS = os.path.join(PROJECT_DIR, "capacitor.config.ts")
PACKAGE_JSON = os.path.join(PROJECT_DIR, "package.json")

EXPECTED_APP_ID = "com.zealt.vuedemo"
EXPECTED_APP_NAME = "Vue Capacitor Demo"
EXPECTED_WEB_DIR = "www"

HOST = "127.0.0.1"
PORT = 8123
BASE_URL = f"http://{HOST}:{PORT}/"


# ---------------------------------------------------------------------------
# Session setup: build the web assets fresh so the build is verified.
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session", autouse=True)
def build_web_assets():
    if os.path.isdir(WEB_DIR):
        subprocess.run(["rm", "-rf", WEB_DIR], check=True)
    result = subprocess.run(
        ["npm", "run", "build"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=600,
    )
    print("===== npm run build stdout =====")
    print(result.stdout)
    print("===== npm run build stderr =====")
    print(result.stderr)
    assert result.returncode == 0, (
        f"'npm run build' failed with exit code {result.returncode}. "
        f"stderr: {result.stderr}"
    )
    yield


def _load_package_json():
    with open(PACKAGE_JSON) as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# 1. Capacitor dependencies installed (v8)
# ---------------------------------------------------------------------------
def test_capacitor_core_is_dependency():
    pkg = _load_package_json()
    deps = pkg.get("dependencies", {})
    assert "@capacitor/core" in deps, (
        "@capacitor/core must be listed under 'dependencies' in package.json."
    )


def test_capacitor_cli_is_dev_dependency():
    pkg = _load_package_json()
    dev_deps = pkg.get("devDependencies", {})
    assert "@capacitor/cli" in dev_deps, (
        "@capacitor/cli must be listed under 'devDependencies' in package.json."
    )


def _installed_version(pkg_name):
    installed = os.path.join(PROJECT_DIR, "node_modules", *pkg_name.split("/"), "package.json")
    assert os.path.isfile(installed), f"{pkg_name} is not installed at {installed}."
    with open(installed) as f:
        return json.load(f).get("version", "")


def test_capacitor_core_is_v8():
    version = _installed_version("@capacitor/core")
    assert version.startswith("8."), (
        f"Expected @capacitor/core major version 8, got '{version}'."
    )


def test_capacitor_cli_is_v8():
    version = _installed_version("@capacitor/cli")
    assert version.startswith("8."), (
        f"Expected @capacitor/cli major version 8, got '{version}'."
    )


# ---------------------------------------------------------------------------
# 2. No native platforms were added (web-only constraint)
# ---------------------------------------------------------------------------
def test_no_native_platform_packages():
    pkg = _load_package_json()
    all_deps = {}
    all_deps.update(pkg.get("dependencies", {}))
    all_deps.update(pkg.get("devDependencies", {}))
    assert "@capacitor/android" not in all_deps, (
        "@capacitor/android must not be installed; this is a web-only bootstrap task."
    )
    assert "@capacitor/ios" not in all_deps, (
        "@capacitor/ios must not be installed; this is a web-only bootstrap task."
    )


def test_no_native_project_directories():
    for platform in ("android", "ios"):
        path = os.path.join(PROJECT_DIR, platform)
        assert not os.path.isdir(path), (
            f"Native project directory '{path}' must not exist; do not add native platforms."
        )


# ---------------------------------------------------------------------------
# 3. Valid capacitor.config.ts with the expected values
# ---------------------------------------------------------------------------
def _read_config_values():
    """Transpile capacitor.config.ts and import its default export to read values.

    Falls back to a regex extraction if the transpile/import path is unavailable.
    """
    assert os.path.isfile(CONFIG_TS), f"{CONFIG_TS} does not exist."

    evaluator = os.path.join(PROJECT_DIR, "__cap_config_eval.cjs")
    script = (
        "const fs = require('fs');\n"
        "const path = require('path');\n"
        "const os = require('os');\n"
        "const url = require('url');\n"
        "const ts = require('typescript');\n"
        "const src = fs.readFileSync(process.argv[2], 'utf8');\n"
        "const out = ts.transpileModule(src, { compilerOptions: { module: 'ESNext', target: 'ES2020' } }).outputText;\n"
        "const tmp = path.join(os.tmpdir(), 'cap_config_' + process.pid + '.mjs');\n"
        "fs.writeFileSync(tmp, out);\n"
        "import(url.pathToFileURL(tmp).href).then((m) => {\n"
        "  const cfg = (m && m.default) ? m.default : m;\n"
        "  process.stdout.write(JSON.stringify({ appId: cfg.appId, appName: cfg.appName, webDir: cfg.webDir }));\n"
        "  fs.unlinkSync(tmp);\n"
        "}).catch((e) => { console.error(String(e)); process.exit(1); });\n"
    )
    try:
        with open(evaluator, "w") as f:
            f.write(script)
        result = subprocess.run(
            ["node", evaluator, CONFIG_TS],
            cwd=PROJECT_DIR,
            capture_output=True,
            text=True,
            timeout=120,
        )
        if result.returncode == 0 and result.stdout.strip():
            return json.loads(result.stdout.strip())
    finally:
        if os.path.isfile(evaluator):
            os.remove(evaluator)

    # Fallback: regex extraction from source.
    with open(CONFIG_TS) as f:
        content = f.read()

    def grab(key):
        m = re.search(rf"{key}\s*:\s*['\"]([^'\"]+)['\"]", content)
        return m.group(1) if m else None

    return {
        "appId": grab("appId"),
        "appName": grab("appName"),
        "webDir": grab("webDir"),
    }


def test_config_app_id():
    values = _read_config_values()
    assert values.get("appId") == EXPECTED_APP_ID, (
        f"capacitor.config.ts appId must be '{EXPECTED_APP_ID}', got '{values.get('appId')}'."
    )


def test_config_app_name():
    values = _read_config_values()
    assert values.get("appName") == EXPECTED_APP_NAME, (
        f"capacitor.config.ts appName must be '{EXPECTED_APP_NAME}', got '{values.get('appName')}'."
    )


def test_config_web_dir():
    values = _read_config_values()
    assert values.get("webDir") == EXPECTED_WEB_DIR, (
        f"capacitor.config.ts webDir must be '{EXPECTED_WEB_DIR}', got '{values.get('webDir')}'."
    )


# ---------------------------------------------------------------------------
# 4. Build output aligned with webDir
# ---------------------------------------------------------------------------
def test_web_dir_contains_index_html():
    index_html = os.path.join(WEB_DIR, "index.html")
    assert os.path.isfile(index_html), (
        f"Expected build output {index_html} to exist (webDir 'www' must contain index.html)."
    )


def test_index_html_references_existing_bundle():
    index_html = os.path.join(WEB_DIR, "index.html")
    with open(index_html) as f:
        html = f.read()
    srcs = re.findall(r"<script[^>]+src=[\"']([^\"']+)[\"']", html)
    assert srcs, "Expected the built index.html to include at least one <script src=...> tag."

    found = False
    for src in srcs:
        rel = src.split("?")[0].lstrip("/")
        candidate = os.path.join(WEB_DIR, rel)
        if os.path.isfile(candidate):
            found = True
            break
    assert found, (
        f"None of the script sources referenced by index.html exist under {WEB_DIR}: {srcs}"
    )


# ---------------------------------------------------------------------------
# 5. Capacitor CLI can load the config and resolve webDir
# ---------------------------------------------------------------------------
def test_capacitor_cli_loads_config():
    result = subprocess.run(
        ["npx", "cap", "copy"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=180,
    )
    combined = (result.stdout or "") + (result.stderr or "")
    print("===== npx cap copy output =====")
    print(combined)
    # The CLI may warn/exit because no native platforms are installed; that is fine.
    # It must NOT fail to load the config or report a missing web assets directory.
    assert "Could not find the web assets directory" not in combined, (
        "Capacitor reported a missing web assets directory; webDir is not aligned with the build output."
    )
    assert "Invalid Capacitor config" not in combined and "SyntaxError" not in combined, (
        f"Capacitor failed to load capacitor.config.ts. Output: {combined}"
    )


# ---------------------------------------------------------------------------
# 6. Browser verification: serve www and confirm the Vue app renders.
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def browser_verifier():
    return PochiVerifier()


@pytest.fixture(scope="session")
def serve_web(build_web_assets, xprocess):
    class Starter(ProcessStarter):
        name = "serve_web"
        args = ["python3", "-m", "http.server", str(PORT), "--bind", HOST]
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": WEB_DIR,
            "text": True,
        }
        timeout = 60
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
        try:
            with open(info.logpath, "r") as f:
                lines = f.readlines()
        except OSError:
            lines = []
        new_lines = lines[printed:]
        printed = len(lines)
        print(f"===== [{tag}] serve_web log =====")
        print("".join(new_lines))

    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield

    capture_logs("TEARDOWN")
    info.terminate()


def test_built_app_renders_in_browser(serve_web, browser_verifier):
    reason = (
        "The Vue app must be bundled by Vite into the aligned webDir ('www') and load "
        "correctly when served as static assets."
    )
    truth = (
        f"Navigate to {BASE_URL}. Wait for the page to finish loading and the Vue app to "
        f"mount. Verify that the rendered page contains the visible heading text "
        f"'{EXPECTED_APP_NAME}'."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_built_app_renders_in_browser",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
