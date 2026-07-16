import json
import os
import re
import socket
import subprocess

import pytest
import requests
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/capacitor-http-app"
PORT = 8787
# Connect over IPv4 explicitly first. On Node 17+ an unqualified "localhost" can
# resolve to the IPv6 loopback (::1); we probe a list of candidates so the tests
# work regardless of which loopback the mock server bound to.
BASE_URL_CANDIDATES = [
    f"http://127.0.0.1:{PORT}",
    f"http://localhost:{PORT}",
    f"http://[::1]:{PORT}",
]
API_KEY = "local-dev-key-123"

ENV = os.environ.copy()


def _reachable(base_url: str) -> bool:
    try:
        resp = requests.get(f"{base_url}/api/products", timeout=5)
        return resp.status_code == 200
    except requests.RequestException:
        return False


def resolve_base_url() -> str:
    for candidate in BASE_URL_CANDIDATES:
        if _reachable(candidate):
            return candidate
    raise AssertionError(
        f"Mock server is not reachable on any of {BASE_URL_CANDIDATES} at /api/products."
    )


@pytest.fixture(scope="session")
def mock_server(xprocess):
    """Start the mock API server via `npm run mock` and wait until it is ready."""

    class Starter(ProcessStarter):
        name = "mock_server"
        args = ["npm", "run", "mock"]
        env = ENV
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 120
        terminate_on_interrupt = True

        def startup_check(self):
            for candidate in BASE_URL_CANDIDATES:
                port = PORT
                # First a cheap TCP probe on IPv4/IPv6 loopback.
                family = socket.AF_INET6 if candidate.startswith("http://[::1]") else socket.AF_INET
                host = "::1" if family == socket.AF_INET6 else "127.0.0.1"
                with socket.socket(family, socket.SOCK_STREAM) as s:
                    s.settimeout(1)
                    if s.connect_ex((host, port)) != 0:
                        continue
                if _reachable(candidate):
                    return True
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
        new = lines[printed:]
        printed = len(lines)
        print(f"===== [{tag}] mock_server log begin =====")
        print("".join(new))
        print(f"===== [{tag}] mock_server log end =====")

    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield resolve_base_url()

    capture_logs("TEARDOWN")
    info.terminate()


# --------------------------------------------------------------------------
# 1. Capacitor configuration
# --------------------------------------------------------------------------
def test_capacitor_config_enables_http_and_metadata():
    config_path = os.path.join(PROJECT_DIR, "capacitor.config.ts")
    assert os.path.isfile(config_path), f"Expected Capacitor config at {config_path}."

    tsx_bin = os.path.join(PROJECT_DIR, "node_modules", ".bin", "tsx")
    assert os.path.isfile(tsx_bin), "tsx runner not found; cannot evaluate capacitor.config.ts."

    evaluator = os.path.join(PROJECT_DIR, "__verify_config.mts")
    evaluator_code = (
        "const mod = await import('./capacitor.config.ts');\n"
        "const cfg = mod.default ?? mod;\n"
        "console.log('CONFIG_JSON_START' + JSON.stringify(cfg) + 'CONFIG_JSON_END');\n"
    )
    with open(evaluator, "w") as f:
        f.write(evaluator_code)

    try:
        result = subprocess.run(
            [tsx_bin, evaluator],
            cwd=PROJECT_DIR,
            capture_output=True,
            text=True,
            env=ENV,
            timeout=120,
        )
    finally:
        if os.path.isfile(evaluator):
            os.remove(evaluator)

    assert result.returncode == 0, (
        f"Failed to evaluate capacitor.config.ts with tsx.\n"
        f"stdout: {result.stdout}\nstderr: {result.stderr}"
    )
    match = re.search(r"CONFIG_JSON_START(.*)CONFIG_JSON_END", result.stdout, re.DOTALL)
    assert match, f"Could not extract config JSON from tsx output:\n{result.stdout}"
    config = json.loads(match.group(1))

    assert config.get("appId") == "com.example.httpdemo", (
        f"Expected appId 'com.example.httpdemo', got {config.get('appId')!r}."
    )
    assert config.get("appName") == "HttpDemo", (
        f"Expected appName 'HttpDemo', got {config.get('appName')!r}."
    )
    assert config.get("webDir") == "dist", (
        f"Expected webDir 'dist', got {config.get('webDir')!r}."
    )
    plugins = config.get("plugins") or {}
    cap_http = plugins.get("CapacitorHttp") or {}
    assert cap_http.get("enabled") is True, (
        f"Expected plugins.CapacitorHttp.enabled === true, got {cap_http!r}."
    )


# --------------------------------------------------------------------------
# 2. The typed client is built on CapacitorHttp
# --------------------------------------------------------------------------
def test_client_uses_capacitor_http():
    tokens_found = {"capacitor_http": False, "core_import": False}
    for root, dirs, files in os.walk(PROJECT_DIR):
        if "node_modules" in dirs:
            dirs.remove("node_modules")
        if "dist" in dirs:
            dirs.remove("dist")
        for name in files:
            if not name.endswith((".ts", ".tsx", ".mts", ".js", ".mjs")):
                continue
            if name == "capacitor.config.ts":
                continue
            path = os.path.join(root, name)
            try:
                with open(path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
            except OSError:
                continue
            if "CapacitorHttp" in content:
                tokens_found["capacitor_http"] = True
            if "@capacitor/core" in content:
                tokens_found["core_import"] = True
    assert tokens_found["capacitor_http"], (
        "No project source file references `CapacitorHttp`; the client must use the "
        "CapacitorHttp plugin."
    )
    assert tokens_found["core_import"], (
        "No project source file imports from `@capacitor/core`; the client must use "
        "CapacitorHttp from @capacitor/core."
    )


# --------------------------------------------------------------------------
# 3-7. Mock server behavior (verified directly over HTTP)
# --------------------------------------------------------------------------
def test_list_products(mock_server):
    resp = requests.get(f"{mock_server}/api/products", timeout=10)
    assert resp.status_code == 200, f"GET /api/products expected 200, got {resp.status_code}."
    products = resp.json()
    assert isinstance(products, list) and len(products) == 3, (
        f"Expected a JSON array of 3 products, got {products!r}."
    )
    by_id = {p.get("id"): p for p in products}
    assert 2 in by_id, f"Expected a product with id 2, got ids {list(by_id)}."
    assert by_id[2].get("name") == "Pen", f"Product 2 name should be 'Pen', got {by_id[2]!r}."
    assert by_id[2].get("price") == 2, f"Product 2 price should be 2, got {by_id[2]!r}."


def test_product_not_found(mock_server):
    resp = requests.get(f"{mock_server}/api/products/999", timeout=10)
    assert resp.status_code == 404, (
        f"GET /api/products/999 expected 404, got {resp.status_code}."
    )
    body = resp.json()
    assert isinstance(body.get("error"), str) and body["error"], (
        f"Expected a JSON body with a non-empty string 'error' field, got {body!r}."
    )


def test_order_unauthorized(mock_server):
    resp = requests.post(
        f"{mock_server}/api/orders",
        json={"productId": 3, "quantity": 2},
        headers={"Content-Type": "application/json"},
        timeout=10,
    )
    assert resp.status_code == 401, (
        f"POST /api/orders without a valid X-Api-Key expected 401, got {resp.status_code}."
    )


def test_order_bad_quantity(mock_server):
    resp = requests.post(
        f"{mock_server}/api/orders",
        json={"productId": 3, "quantity": 0},
        headers={"Content-Type": "application/json", "X-Api-Key": API_KEY},
        timeout=10,
    )
    assert resp.status_code == 400, (
        f"POST /api/orders with quantity 0 expected 400, got {resp.status_code}."
    )


def test_order_success(mock_server):
    resp = requests.post(
        f"{mock_server}/api/orders",
        json={"productId": 3, "quantity": 2},
        headers={"Content-Type": "application/json", "X-Api-Key": API_KEY},
        timeout=10,
    )
    assert resp.status_code == 201, (
        f"POST /api/orders with a valid key expected 201, got {resp.status_code}: {resp.text}"
    )
    body = resp.json()
    assert body.get("total") == 80, (
        f"Order total should be 80 (price 40 x quantity 2), got {body!r}."
    )
    assert isinstance(body.get("orderId"), str) and body["orderId"], (
        f"Order should include a non-empty string 'orderId', got {body!r}."
    )


# --------------------------------------------------------------------------
# 8. End-to-end round-trip client run
# --------------------------------------------------------------------------
def test_roundtrip_client(mock_server):
    result = subprocess.run(
        ["npm", "run", "roundtrip"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        env=ENV,
        timeout=120,
    )
    assert result.returncode == 0, (
        f"`npm run roundtrip` exited with {result.returncode}.\n"
        f"stdout: {result.stdout}\nstderr: {result.stderr}"
    )
    match = re.search(r"^RESULT:\s*(\{.*\})\s*$", result.stdout, re.MULTILINE)
    assert match, (
        f"Could not find a 'RESULT: <json>' line in roundtrip stdout:\n{result.stdout}"
    )
    summary = json.loads(match.group(1))

    assert summary.get("productCount") == 3, (
        f"Expected productCount 3, got {summary.get('productCount')!r}."
    )
    assert summary.get("product2Name") == "Pen", (
        f"Expected product2Name 'Pen', got {summary.get('product2Name')!r}."
    )
    assert summary.get("orderTotal") == 80, (
        f"Expected orderTotal 80, got {summary.get('orderTotal')!r}."
    )
    assert isinstance(summary.get("orderId"), str) and summary["orderId"], (
        f"Expected a non-empty string orderId, got {summary.get('orderId')!r}."
    )
    assert summary.get("missingProductStatus") == 404, (
        f"Expected missingProductStatus 404 (typed error status), got "
        f"{summary.get('missingProductStatus')!r}."
    )
    assert summary.get("unauthorizedStatus") == 401, (
        f"Expected unauthorizedStatus 401 (typed error status), got "
        f"{summary.get('unauthorizedStatus')!r}."
    )
