import os
import json
import time
import socket
import subprocess
import signal

PROJECT_DIR = "/home/user/myproject"


def wait_for_port(port, timeout=60):
    start = time.time()
    while time.time() - start < timeout:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(("localhost", port)) == 0:
                return True
        time.sleep(2)
    return False


def http_request(method, path, body=None, headers=None):
    import urllib.request, urllib.error
    url = f"http://localhost:3000{path}"
    data = json.dumps(body).encode() if body else None
    req_headers = {"Content-Type": "application/json"}
    if headers:
        req_headers.update(headers)
    req = urllib.request.Request(url, data=data, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, json.loads(resp.read())
    except Exception as e:
        return 500, {"error": str(e)}


def test_server_js_exists():
    assert os.path.isfile(os.path.join(PROJECT_DIR, "server.js")), \
        "server.js must exist"


def test_multi_tenant_isolation():
    """Priority 1: Start server and verify tenant isolation."""
    proc = subprocess.Popen(
        ["node", "server.js"],
        cwd=PROJECT_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        preexec_fn=os.setsid,
    )
    try:
        assert wait_for_port(3000, timeout=60), "Server must start on port 3000"

        # Create acme item
        status, _ = http_request("POST", "/items", {"name": "Widget"},
                                 {"x-tenant-id": "acme"})
        assert status in (200, 201), f"POST /items for acme must succeed; got {status}"

        # Create globex item
        status, _ = http_request("POST", "/items", {"name": "Gadget"},
                                 {"x-tenant-id": "globex"})
        assert status in (200, 201), f"POST /items for globex must succeed; got {status}"

        # Get acme items
        status, acme_items = http_request("GET", "/items", headers={"x-tenant-id": "acme"})
        assert status == 200, f"GET /items for acme must return 200; got {status}"
        acme_names = [i.get("name") for i in acme_items]
        assert "Widget" in acme_names, f"Acme must see Widget; got: {acme_names}"
        assert "Gadget" not in acme_names, f"Acme must NOT see Gadget; got: {acme_names}"

        # Get globex items
        status, globex_items = http_request("GET", "/items", headers={"x-tenant-id": "globex"})
        assert status == 200, f"GET /items for globex must return 200; got {status}"
        globex_names = [i.get("name") for i in globex_items]
        assert "Gadget" in globex_names, f"Globex must see Gadget; got: {globex_names}"
        assert "Widget" not in globex_names, f"Globex must NOT see Widget; got: {globex_names}"

    finally:
        os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
        proc.wait(timeout=10)
