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


def http_request(method, path, body=None):
    import urllib.request, urllib.error
    url = f"http://localhost:3000{path}"
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json"}
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw = resp.read()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        return e.code, {}


def test_server_js_exists():
    assert os.path.isfile(os.path.join(PROJECT_DIR, "server.js")), \
        "server.js must exist"


def test_task_api_full_crud():
    """Priority 1: Full CRUD cycle against the running server."""
    proc = subprocess.Popen(
        ["node", "server.js"],
        cwd=PROJECT_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        preexec_fn=os.setsid,
    )
    try:
        assert wait_for_port(3000, timeout=60), "Server must start on port 3000"

        # Create user
        status, user = http_request("POST", "/users", {"email": "dev@test.com", "name": "Dev"})
        assert status in (200, 201), f"POST /users must succeed; got {status}"
        user_id = user["id"]

        # Create task
        status, task = http_request("POST", "/tasks", {
            "title": "Fix bug", "userId": user_id, "priority": 1
        })
        assert status in (200, 201), f"POST /tasks must succeed; got {status}"
        task_id = task["id"]

        # List tasks with filter
        status, tasks = http_request("GET", "/tasks?status=todo")
        assert status == 200, f"GET /tasks?status=todo must return 200; got {status}"
        assert any(t.get("id") == task_id for t in tasks), \
            f"Created task must appear in todo list; got: {tasks}"

        # Get single task with user
        status, task_data = http_request("GET", f"/tasks/{task_id}")
        assert status == 200, f"GET /tasks/{task_id} must return 200; got {status}"
        assert task_data.get("user", {}).get("email") == "dev@test.com", \
            f"Task must include user with email 'dev@test.com'; got: {task_data.get('user')}"

        # Update task
        status, updated = http_request("PATCH", f"/tasks/{task_id}", {"status": "done"})
        assert status == 200, f"PATCH /tasks/{task_id} must return 200; got {status}"
        assert updated.get("status") == "done", \
            f"Task status must be 'done' after update; got: {updated.get('status')}"

        # Delete task
        status, _ = http_request("DELETE", f"/tasks/{task_id}")
        assert status == 204, f"DELETE /tasks/{task_id} must return 204; got {status}"

        # Confirm deleted
        status, all_tasks = http_request("GET", "/tasks")
        assert status == 200, f"GET /tasks must return 200 after delete; got {status}"
        assert not any(t.get("id") == task_id for t in all_tasks), \
            f"Deleted task must not appear in task list"

    finally:
        os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
        proc.wait(timeout=10)
