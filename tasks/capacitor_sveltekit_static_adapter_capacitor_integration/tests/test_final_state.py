import json
import os
import re
import shutil
import socket
import subprocess

import pytest
import requests
from pochi_verifier import PochiVerifier
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/capsvelte"
DIST_DIR = os.path.join(PROJECT_DIR, "dist")
CAP_CONFIG = os.path.join(PROJECT_DIR, "capacitor.config.ts")
SVELTE_CONFIG = os.path.join(PROJECT_DIR, "svelte.config.js")
PACKAGE_JSON = os.path.join(PROJECT_DIR, "package.json")

HOST = "127.0.0.1"
PORT = 8099
BASE_URL = f"http://{HOST}:{PORT}"

# Minimal static single-page-app server: serves files from DIST_DIR and falls
# back to 200.html for any path that does not correspond to an existing file,
# mirroring how a Capacitor webview serves a local SPA bundle.
SPA_SERVER_CODE = (
    "import http.server, socketserver, os, sys\n"
    "DIST = sys.argv[1]\n"
    "PORT = int(sys.argv[2])\n"
    "class H(http.server.SimpleHTTPRequestHandler):\n"
    "    def __init__(self, *a, **k):\n"
    "        super().__init__(*a, directory=DIST, **k)\n"
    "    def send_head(self):\n"
    "        path = self.translate_path(self.path)\n"
    "        if os.path.isdir(path):\n"
    "            if os.path.exists(os.path.join(path, 'index.html')):\n"
    "                return super().send_head()\n"
    "            self.path = '/200.html'\n"
    "        elif not os.path.exists(path):\n"
    "            self.path = '/200.html'\n"
    "        return super().send_head()\n"
    "socketserver.TCPServer.allow_reuse_address = True\n"
    "with socketserver.TCPServer((%r, PORT), H) as httpd:\n"
    "    httpd.serve_forever()\n"
) % HOST


@pytest.fixture(scope="session")
def build_project():
    """Rebuild the static bundle from the executor's configuration."""
    if os.path.isdir(DIST_DIR):
        shutil.rmtree(DIST_DIR)
    result = subprocess.run(
        ["npm", "run", "build"],
        capture_output=True,
        text=True,
        cwd=PROJECT_DIR,
        timeout=600,
    )
    print("===== npm run build stdout =====")
    print(result.stdout)
    print("===== npm run build stderr =====")
    print(result.stderr)
    assert result.returncode == 0, (
        f"`npm run build` failed with exit code {result.returncode}. See logs above."
    )
    return DIST_DIR


@pytest.fixture(scope="session")
def browser_verifier():
    return PochiVerifier()


@pytest.fixture(scope="session")
def spa_server(xprocess, build_project):
    class Starter(ProcessStarter):
        name = "spa_server"
        args = ["python3", "-c", SPA_SERVER_CODE, DIST_DIR, str(PORT)]
        env = os.environ.copy()
        popen_kwargs = {"cwd": PROJECT_DIR, "text": True}
        timeout = 60
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex((HOST, PORT)) != 0:
                    return False
            try:
                resp = requests.get(BASE_URL + "/", timeout=10)
                return resp.status_code < 500
            except requests.RequestException:
                return False

    info = xprocess.getinfo(Starter.name)
    printed = 0

    def capture_logs(tag):
        nonlocal printed
        try:
            with open(info.logpath) as f:
                lines = f.readlines()
        except OSError:
            return
        new = lines[printed:]
        printed = len(lines)
        print(f"===== [{tag}] spa_server log =====")
        print("".join(new))

    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield BASE_URL

    capture_logs("TEARDOWN")
    info.terminate()


def _read(path):
    with open(path) as f:
        return f.read()


def test_adapter_static_dependency_present(build_project):
    with open(PACKAGE_JSON) as f:
        pkg = json.load(f)
    all_deps = {}
    all_deps.update(pkg.get("dependencies", {}))
    all_deps.update(pkg.get("devDependencies", {}))
    assert "@sveltejs/adapter-static" in all_deps, (
        "Expected @sveltejs/adapter-static to be listed in package.json dependencies."
    )


def test_svelte_config_uses_static_adapter(build_project):
    content = _read(SVELTE_CONFIG)
    assert "@sveltejs/adapter-static" in content, (
        "svelte.config.js must import the adapter from @sveltejs/adapter-static."
    )
    assert "@sveltejs/adapter-auto" not in content, (
        "svelte.config.js must no longer import @sveltejs/adapter-auto."
    )


def test_dist_directory_created(build_project):
    assert os.path.isdir(DIST_DIR), (
        f"Expected the static bundle directory {DIST_DIR} to exist after the build."
    )


def test_prerendered_index_html(build_project):
    index_path = os.path.join(DIST_DIR, "index.html")
    assert os.path.isfile(index_path), f"Expected prerendered {index_path} to exist."
    content = _read(index_path)
    assert "Capacitor SvelteKit Home" in content, (
        "dist/index.html must contain the prerendered home-page text 'Capacitor SvelteKit Home'."
    )


def test_spa_fallback_page(build_project):
    fallback_path = os.path.join(DIST_DIR, "200.html")
    assert os.path.isfile(fallback_path), (
        "Expected the SPA fallback page dist/200.html to be generated by adapter-static."
    )


def test_client_assets_emitted(build_project):
    app_dir = os.path.join(DIST_DIR, "_app")
    assert os.path.isdir(app_dir), (
        "Expected dist/_app (SvelteKit client JS/CSS) to exist, confirming a real static build."
    )


def test_capacitor_webdir_aligned(build_project):
    content = _read(CAP_CONFIG)
    match = re.search(r"webDir\s*:\s*['\"]([^'\"]+)['\"]", content)
    assert match is not None, "Could not find a webDir string in capacitor.config.ts."
    web_dir = match.group(1)
    assert web_dir == "dist", (
        f"capacitor.config.ts webDir must be exactly 'dist', found '{web_dir}'."
    )
    # Capacitor's web-asset detection requires an index.html inside webDir.
    web_dir_index = os.path.join(PROJECT_DIR, web_dir, "index.html")
    assert os.path.isfile(web_dir_index), (
        f"Capacitor webDir '{web_dir}' must contain index.html for `npx cap sync` to succeed; "
        f"missing {web_dir_index}."
    )


def test_browser_home_page_renders(spa_server, browser_verifier):
    reason = (
        "The statically prerendered home page must be served from the Capacitor-ready bundle "
        "and display its heading text."
    )
    truth = (
        f"Navigate to {BASE_URL}/ and verify the page contains the text "
        f"'Capacitor SvelteKit Home'."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_browser_home_page_renders",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


def test_browser_status_route_via_fallback(spa_server, browser_verifier):
    reason = (
        "The /status route is not prerendered; it must be served through the 200.html SPA "
        "fallback and rendered client-side by JavaScript."
    )
    truth = (
        f"Navigate to {BASE_URL}/status and wait for the client-side app to hydrate. "
        f"Verify the page contains the text 'Runtime Status: READY'."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_browser_status_route_via_fallback",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
