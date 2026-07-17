import os
import socket
import subprocess
import time

import pytest
import requests
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/nested-comments"

# Bind/connect over IPv4 explicitly. On Node 17+ `localhost` can resolve to the
# IPv6 loopback (::1), so a server may listen on ::1 only while an AF_INET socket
# to 127.0.0.1 never connects -> a readiness check would hang until timeout.
HOST = "127.0.0.1"
SERVER_PORT = 3001
CLIENT_PORT = 3000
SERVER_URL = f"http://{HOST}:{SERVER_PORT}"

SEED_POST_TITLE = "Wasp Nested Comments"

NODE_KEYS = {"id", "content", "authorUsername", "parentId", "children"}


def _op_url(name: str) -> str:
    return f"{SERVER_URL}/operations/{name}"


def call_op(name: str, args: dict):
    """Call a Wasp operation over HTTP.

    Wasp exposes operations at POST /operations/<kebab-name> and uses superjson on
    the wire: the request body is {"json": <args>} and the result is in the
    response body's "json" field.
    """
    resp = requests.post(
        _op_url(name),
        json={"json": args},
        headers={"Content-Type": "application/json"},
        timeout=30,
    )
    assert resp.status_code == 200, (
        f"Operation '{name}' returned status {resp.status_code} "
        f"(body: {resp.text[:500]})"
    )
    body = resp.json()
    assert isinstance(body, dict) and "json" in body, (
        f"Operation '{name}' response is not superjson-shaped, got: {body}"
    )
    return body["json"]


def find_node(nodes, node_id):
    for n in nodes:
        if n.get("id") == node_id:
            return n
        found = find_node(n.get("children", []) or [], node_id)
        if found is not None:
            return found
    return None


def all_ids(nodes):
    ids = []
    for n in nodes:
        ids.append(n.get("id"))
        ids.extend(all_ids(n.get("children", []) or []))
    return ids


def iter_nodes(nodes):
    for n in nodes:
        yield n
        yield from iter_nodes(n.get("children", []) or [])


@pytest.fixture(scope="session")
def wasp_app(xprocess):
    """Migrate + seed the database, then start `wasp start` and wait until the
    server's operations endpoint is answering."""
    env = os.environ.copy()

    # Apply migrations (a no-op if already migrated). --name avoids the interactive
    # migration-name prompt.
    migrate = subprocess.run(
        ["wasp", "db", "migrate-dev", "--name", "verify"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        env=env,
        timeout=900,
    )
    print("=== wasp db migrate-dev stdout ===\n" + migrate.stdout)
    print("=== wasp db migrate-dev stderr ===\n" + migrate.stderr)

    # Seed deterministic data (idempotent).
    seed = subprocess.run(
        ["wasp", "db", "seed", "devSeed"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        env=env,
        timeout=900,
    )
    print("=== wasp db seed devSeed stdout ===\n" + seed.stdout)
    print("=== wasp db seed devSeed stderr ===\n" + seed.stderr)
    assert seed.returncode == 0, f"'wasp db seed devSeed' failed: {seed.stderr}"

    class Starter(ProcessStarter):
        name = "wasp_app"
        args = ["wasp", "start"]
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 900
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex((HOST, SERVER_PORT)) != 0:
                    return False
            try:
                resp = requests.post(
                    _op_url("get-posts"),
                    json={"json": {}},
                    headers={"Content-Type": "application/json"},
                    timeout=20,
                )
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
        new = lines[printed:]
        printed = len(lines)
        print(f"===== [{tag}] wasp start log =====")
        print("".join(new))
        print(f"===== [{tag}] end log =====")

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
def scenario(wasp_app):
    """Run the full comment-tree scenario once and expose the observed state."""
    posts = call_op("get-posts", {})
    assert isinstance(posts, list), f"getPosts must return a list, got: {posts}"
    seeded = [p for p in posts if p.get("title") == SEED_POST_TITLE]
    assert seeded, (
        f"No post titled '{SEED_POST_TITLE}' found in getPosts result: {posts}"
    )
    post_id = seeded[0]["id"]

    def create(author, content, parent_id=None):
        args = {"postId": post_id, "authorUsername": author, "content": content}
        if parent_id is not None:
            args["parentId"] = parent_id
        result = call_op("create-comment", args)
        assert isinstance(result, dict) and isinstance(result.get("id"), int), (
            f"createComment must return an object with a numeric id, got: {result}"
        )
        return result["id"]

    a = create("alice", "root-alice")
    b = create("bob", "reply-bob", a)
    c = create("alice", "reply2-alice", b)
    d = create("bob", "root2-bob")

    tree_before = call_op("get-comment-tree", {"postId": post_id})

    call_op("delete-comment", {"commentId": a})
    # Give the write a brief moment to settle before re-reading.
    time.sleep(1)
    tree_after = call_op("get-comment-tree", {"postId": post_id})

    return {
        "post_id": post_id,
        "ids": {"A": a, "B": b, "C": c, "D": d},
        "tree_before": tree_before,
        "tree_after": tree_after,
    }


def test_get_posts_returns_seeded_post(scenario):
    assert isinstance(scenario["post_id"], int), "Seeded post id should be an integer."


def test_created_comments_have_ids(scenario):
    ids = scenario["ids"]
    for label, value in ids.items():
        assert isinstance(value, int), f"createComment for {label} did not return an int id."


def test_node_shape_keys(scenario):
    tree = scenario["tree_before"]
    assert isinstance(tree, list), "getCommentTree must return a list of root nodes."
    for node in iter_nodes(tree):
        assert set(node.keys()) == NODE_KEYS, (
            f"Comment node has unexpected keys {set(node.keys())}, expected {NODE_KEYS}."
        )


def test_root_alice_node(scenario):
    ids = scenario["ids"]
    tree = scenario["tree_before"]
    a = find_node(tree, ids["A"])
    assert a is not None, "Top-level comment A ('root-alice') not found in the tree."
    assert a["content"] == "root-alice", f"Comment A content mismatch: {a['content']}"
    assert a["authorUsername"] == "alice", f"Comment A author mismatch: {a['authorUsername']}"
    assert a["parentId"] is None, f"Comment A should be top-level (parentId null): {a['parentId']}"
    child_ids = [ch["id"] for ch in a["children"]]
    assert child_ids == [ids["B"]], f"Comment A children should be exactly [B], got {child_ids}"


def test_reply_bob_node(scenario):
    ids = scenario["ids"]
    b = find_node(scenario["tree_before"], ids["B"])
    assert b is not None, "Reply comment B ('reply-bob') not found in the tree."
    assert b["content"] == "reply-bob", f"Comment B content mismatch: {b['content']}"
    assert b["authorUsername"] == "bob", f"Comment B author mismatch: {b['authorUsername']}"
    assert b["parentId"] == ids["A"], f"Comment B parentId should be A, got {b['parentId']}"
    child_ids = [ch["id"] for ch in b["children"]]
    assert child_ids == [ids["C"]], f"Comment B children should be exactly [C], got {child_ids}"


def test_reply2_alice_node(scenario):
    ids = scenario["ids"]
    c = find_node(scenario["tree_before"], ids["C"])
    assert c is not None, "Deeply nested reply comment C ('reply2-alice') not found."
    assert c["content"] == "reply2-alice", f"Comment C content mismatch: {c['content']}"
    assert c["authorUsername"] == "alice", f"Comment C author mismatch: {c['authorUsername']}"
    assert c["parentId"] == ids["B"], f"Comment C parentId should be B, got {c['parentId']}"
    assert c["children"] == [], f"Comment C should have no children, got {c['children']}"


def test_second_root_node(scenario):
    ids = scenario["ids"]
    d = find_node(scenario["tree_before"], ids["D"])
    assert d is not None, "Top-level comment D ('root2-bob') not found in the tree."
    assert d["content"] == "root2-bob", f"Comment D content mismatch: {d['content']}"
    assert d["authorUsername"] == "bob", f"Comment D author mismatch: {d['authorUsername']}"
    assert d["parentId"] is None, f"Comment D should be top-level (parentId null): {d['parentId']}"
    assert d["children"] == [], f"Comment D should have no children, got {d['children']}"


def test_root_sibling_ordering(scenario):
    ids = scenario["ids"]
    root_ids = [n["id"] for n in scenario["tree_before"]]
    assert ids["A"] in root_ids, "Comment A missing from top-level nodes."
    assert ids["D"] in root_ids, "Comment D missing from top-level nodes."
    assert root_ids.index(ids["A"]) < root_ids.index(ids["D"]), (
        f"Top-level siblings must be ordered by ascending id; got order {root_ids}"
    )


def test_cascade_delete_removes_subtree(scenario):
    ids = scenario["ids"]
    remaining = all_ids(scenario["tree_after"])
    for label in ("A", "B", "C"):
        assert ids[label] not in remaining, (
            f"After deleting A, comment {label} (id={ids[label]}) should be gone, "
            f"but remaining ids are {remaining}"
        )
    assert ids["D"] in [n["id"] for n in scenario["tree_after"]], (
        "Comment D should still be a top-level comment after deleting A."
    )


def _wait_for_client(timeout=180):
    deadline = time.time() + timeout
    last_err = None
    while time.time() < deadline:
        for host in (HOST, "localhost"):
            try:
                resp = requests.get(f"http://{host}:{CLIENT_PORT}", timeout=10)
                if resp.status_code < 500:
                    return True
            except requests.RequestException as e:  # noqa: PERF203
                last_err = e
        time.sleep(2)
    raise AssertionError(f"Client on port {CLIENT_PORT} not ready: {last_err}")


def test_post_page_renders_thread(scenario):
    _wait_for_client()
    post_id = scenario["post_id"]
    verifier = PochiVerifier()
    reason = (
        "The app should render a post's nested comment thread on the /post/:postId "
        "page, displaying the text content of the comments belonging to that post."
    )
    truth = (
        f"Navigate to http://localhost:{CLIENT_PORT}/post/{post_id}. "
        "Verify that the page contains the text 'root2-bob'."
    )
    result = verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_post_page_renders_thread",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
