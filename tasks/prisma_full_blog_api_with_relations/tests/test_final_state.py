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
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, {}


def test_server_js_exists():
    assert os.path.isfile(os.path.join(PROJECT_DIR, "server.js")), \
        "server.js must exist at /home/user/myproject/server.js"


def test_blog_api_endpoints():
    """Priority 1: Start the server and test all endpoints."""
    proc = subprocess.Popen(
        ["node", "server.js"],
        cwd=PROJECT_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        preexec_fn=os.setsid,
    )
    try:
        assert wait_for_port(3000, timeout=60), "Server must start and listen on port 3000"

        # Create user
        status, user = http_request("POST", "/users", {"email": "blogger@test.com", "name": "Blogger"})
        assert status in (200, 201), f"POST /users must return 200/201; got {status}"
        assert "id" in user, f"Response must include user id; got: {user}"
        user_id = user["id"]

        # Create post
        status, post = http_request("POST", "/posts", {"title": "Hello", "content": "World", "authorId": user_id})
        assert status in (200, 201), f"POST /posts must return 200/201; got {status}"
        assert "id" in post, f"Response must include post id; got: {post}"
        post_id = post["id"]

        # Publish post
        status, _ = http_request("PATCH", f"/posts/{post_id}/publish")
        assert status in (200, 201), f"PATCH /posts/{post_id}/publish must return 200/201; got {status}"

        # Add comment
        status, comment = http_request("POST", f"/posts/{post_id}/comments", {"body": "Nice post!", "authorId": user_id})
        assert status in (200, 201), f"POST /posts/{post_id}/comments must return 200/201; got {status}"

        # Get post with relations
        status, post_data = http_request("GET", f"/posts/{post_id}")
        assert status == 200, f"GET /posts/{post_id} must return 200; got {status}"
        assert post_data.get("author", {}).get("email") == "blogger@test.com", \
            f"Post must include author with email 'blogger@test.com'; got: {post_data.get('author')}"
        assert len(post_data.get("comments", [])) >= 1, \
            f"Post must include at least 1 comment; got: {post_data.get('comments')}"

        # Get user posts
        status, posts = http_request("GET", f"/users/{user_id}/posts")
        assert status == 200, f"GET /users/{user_id}/posts must return 200; got {status}"
        assert len(posts) >= 1, f"User must have at least 1 published post; got: {posts}"

    finally:
        os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
        proc.wait(timeout=10)
