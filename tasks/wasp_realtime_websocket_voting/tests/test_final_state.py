import glob
import os
import queue
import random
import socket
import sqlite3
import string
import threading
import time
from concurrent.futures import ThreadPoolExecutor

import pytest
import requests
import socketio
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/app"
HOST = "127.0.0.1"
SERVER_PORT = 3001
CLIENT_PORT = 3000
SERVER_URL = f"http://{HOST}:{SERVER_PORT}"
CLIENT_URL = f"http://{HOST}:{CLIENT_PORT}"
PASSWORD = "Passw0rd!42"
RUN_ID_FILE = "/logs/artifacts/run-id"


def _make_suffix() -> str:
    try:
        with open(RUN_ID_FILE) as handle:
            raw = handle.read().strip()
    except OSError:
        raw = ""
    cleaned = "".join(ch for ch in raw.lower() if ch in string.ascii_lowercase + string.digits)
    if not cleaned:
        cleaned = "zr" + "".join(random.choice(string.ascii_lowercase + string.digits) for _ in range(6))
    # A short random part keeps every verification run (including retries against an
    # already used database) working with fresh polls and accounts.
    nonce = "".join(random.choice(string.ascii_lowercase + string.digits) for _ in range(4))
    return f"{cleaned[:8]}{nonce}"


SUFFIX = _make_suffix()


def slug(base: str) -> str:
    return f"{base}-{SUFFIX}"


def username(base: str) -> str:
    return f"{base}{SUFFIX}"


# --------------------------------------------------------------------------------------
# Application under test
# --------------------------------------------------------------------------------------


@pytest.fixture(scope="session")
def start_app(xprocess):
    class Starter(ProcessStarter):
        name = "wasp_app"
        args = ["wasp", "start"]
        env = {**os.environ, "WASP_TELEMETRY_DISABLE": "1", "BROWSER": "none"}
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 900
        terminate_on_interrupt = True

        def startup_check(self):
            for port in (SERVER_PORT, CLIENT_PORT):
                with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
                    sock.settimeout(2)
                    if sock.connect_ex((HOST, port)) != 0:
                        return False
            try:
                server_response = requests.get(f"{SERVER_URL}/auth/me", timeout=30)
                if server_response.status_code >= 500:
                    return False
                client_response = requests.get(CLIENT_URL, timeout=30)
                return client_response.status_code < 500
            except requests.RequestException:
                return False

    info = xprocess.getinfo(Starter.name)
    printed_lines = 0

    def capture_logs(tag):
        nonlocal printed_lines
        try:
            with open(info.logpath) as handle:
                all_lines = handle.readlines()
        except OSError:
            return
        new_lines = all_lines[printed_lines:]
        printed_lines = len(all_lines)
        print(f"===== [{tag}] wasp start log =====")
        print("".join(new_lines))
        print(f"===== [{tag}] end of log =====")

    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield

    capture_logs("TEARDOWN")
    info.terminate()


# --------------------------------------------------------------------------------------
# HTTP helpers
# --------------------------------------------------------------------------------------


def signup(name: str) -> None:
    response = requests.post(
        f"{SERVER_URL}/auth/username/signup",
        json={"username": name, "password": PASSWORD},
        timeout=60,
    )
    assert response.status_code < 500, (
        f"Signup for {name} failed with server error {response.status_code}: {response.text}"
    )


def login(name: str) -> str:
    response = requests.post(
        f"{SERVER_URL}/auth/username/login",
        json={"username": name, "password": PASSWORD},
        timeout=60,
    )
    assert response.status_code == 200, (
        f"Login for {name} failed with status {response.status_code}: {response.text}"
    )
    payload = response.json()
    assert "sessionId" in payload, f"Login response for {name} has no sessionId: {payload}"
    return payload["sessionId"]


def make_user(name: str) -> str:
    signup(name)
    return login(name)


def create_poll(session_id, slug_value, question, options):
    headers = {"Authorization": f"Bearer {session_id}"} if session_id else {}
    return requests.post(
        f"{SERVER_URL}/api/polls",
        json={"slug": slug_value, "question": question, "options": options},
        headers=headers,
        timeout=60,
    )


def create_poll_ok(session_id, slug_value, question, options):
    response = create_poll(session_id, slug_value, question, options)
    assert response.status_code == 201, (
        f"Expected 201 when creating poll {slug_value}, got {response.status_code}: {response.text}"
    )
    return response.json()


def get_results(slug_value):
    return requests.get(f"{SERVER_URL}/api/polls/{slug_value}/results", timeout=60)


def get_results_ok(slug_value):
    response = get_results(slug_value)
    assert response.status_code == 200, (
        f"Expected 200 from results of {slug_value}, got {response.status_code}: {response.text}"
    )
    return response.json()


def option_by_label(poll_payload, label):
    for option in poll_payload["options"]:
        if option["label"] == label:
            return option
    raise AssertionError(f"Option {label!r} missing from payload {poll_payload}")


# --------------------------------------------------------------------------------------
# WebSocket helpers
# --------------------------------------------------------------------------------------


class PollClient:
    def __init__(self, session_id=None, label="client"):
        self.label = label
        self.states = queue.Queue()
        self.errors = queue.Queue()
        self.client = socketio.Client(reconnection=False)

        @self.client.on("poll:state")
        def _on_state(payload):
            self.states.put(payload)

        @self.client.on("poll:error")
        def _on_error(payload):
            self.errors.put(payload)

        auth = {"sessionId": session_id} if session_id else {}
        self.client.connect(SERVER_URL, auth=auth, wait_timeout=30)

    def emit(self, event, payload=None):
        if payload is None:
            self.client.emit(event)
        else:
            self.client.emit(event, payload)

    def next_state(self, timeout=10):
        try:
            return self.states.get(timeout=timeout)
        except queue.Empty:
            raise AssertionError(
                f"{self.label}: expected a poll:state message but none arrived within {timeout}s"
            )

    def next_error(self, timeout=10):
        try:
            return self.errors.get(timeout=timeout)
        except queue.Empty:
            raise AssertionError(
                f"{self.label}: expected a poll:error message but none arrived within {timeout}s"
            )

    def expect_error(self, code, timeout=10):
        error = self.next_error(timeout=timeout)
        assert error.get("code") == code, f"{self.label}: expected error code {code}, got {error}"
        assert isinstance(error.get("message"), str) and error["message"].strip(), (
            f"{self.label}: expected a non-empty error message, got {error}"
        )
        return error

    def expect_silence(self, seconds=2.0):
        time.sleep(seconds)
        assert self.states.empty(), (
            f"{self.label}: expected no poll:state message, but received {list(self.states.queue)}"
        )

    def drain(self):
        while not self.states.empty():
            self.states.get_nowait()
        while not self.errors.empty():
            self.errors.get_nowait()

    def subscribe(self, slug_value):
        self.emit("poll:subscribe", {"slug": slug_value})
        return self.next_state()

    def close(self):
        try:
            self.client.disconnect()
        except Exception:
            pass


@pytest.fixture
def clients():
    created = []

    def factory(session_id=None, label="client"):
        client = PollClient(session_id=session_id, label=label)
        created.append(client)
        return client

    yield factory

    for client in created:
        client.close()


@pytest.fixture(scope="session")
def users(start_app):
    return {
        "alice": {"name": username("alice"), "session": make_user(username("alice"))},
        "bob": {"name": username("bob"), "session": make_user(username("bob"))},
        "carol": {"name": username("carol"), "session": make_user(username("carol"))},
    }


def assert_state_shape(state, expected_slug):
    for key in (
        "slug",
        "question",
        "isClosed",
        "revision",
        "totalVotes",
        "leaderOptionId",
        "myVoteOptionId",
        "options",
    ):
        assert key in state, f"poll:state payload is missing key {key!r}: {state}"
    assert state["slug"] == expected_slug, f"poll:state is for the wrong poll: {state}"
    positions = [option["position"] for option in state["options"]]
    assert positions == sorted(positions), f"options are not ordered by position: {state}"
    for option in state["options"]:
        for key in ("id", "label", "position", "votes", "voters"):
            assert key in option, f"option entry is missing key {key!r}: {option}"


# --------------------------------------------------------------------------------------
# HTTP API tests
# --------------------------------------------------------------------------------------


def test_create_poll_requires_authentication(start_app):
    response = create_poll(None, slug("p1"), "Lunch?", ["Pizza", "Sushi"])
    assert response.status_code == 401, (
        f"Unauthenticated poll creation must return 401, got {response.status_code}: {response.text}"
    )
    assert response.json() == {"error": "UNAUTHENTICATED"}, (
        f"Unexpected body for unauthenticated poll creation: {response.text}"
    )
    assert get_results(slug("p1")).status_code == 404, (
        "A rejected poll creation must not create a poll."
    )


def test_create_poll_rejects_invalid_payloads(users):
    session = users["alice"]["session"]
    invalid_payloads = [
        ("Bad Slug", "Lunch?", ["Pizza", "Sushi"]),
        (slug("p2"), "", ["Pizza", "Sushi"]),
        (slug("p2"), "Lunch?", ["Pizza"]),
        (slug("p2"), "Lunch?", ["A", "B", "C", "D", "E", "F", "G", "H", "I"]),
        (slug("p2"), "Lunch?", ["Pizza", "Pizza"]),
    ]
    for slug_value, question, options in invalid_payloads:
        response = create_poll(session, slug_value, question, options)
        assert response.status_code == 400, (
            f"Expected 400 for payload slug={slug_value!r} question={question!r} options={options}, "
            f"got {response.status_code}: {response.text}"
        )
        assert response.json() == {"error": "INVALID_PAYLOAD"}, (
            f"Unexpected error body for invalid payload: {response.text}"
        )
    assert get_results(slug("p2")).status_code == 404, (
        "Rejected poll creations must not persist anything."
    )
    missing = get_results(slug("p2"))
    assert missing.json() == {"error": "POLL_NOT_FOUND"}, (
        f"Unexpected body for unknown poll results: {missing.text}"
    )


def test_create_poll_success_and_slug_conflict(users):
    alice = users["alice"]
    poll_slug = slug("lunch")
    payload = create_poll_ok(
        alice["session"], poll_slug, "Where do we eat?", ["Pizza", "Sushi", "Burger"]
    )
    assert payload["slug"] == poll_slug, f"Unexpected slug in creation response: {payload}"
    assert payload["question"] == "Where do we eat?", f"Unexpected question: {payload}"
    assert payload["isClosed"] is False, f"A new poll must be open: {payload}"
    assert payload["revision"] == 0, f"A new poll must start at revision 0: {payload}"
    assert payload["creator"] == alice["name"], f"Unexpected creator in response: {payload}"
    assert [option["label"] for option in payload["options"]] == ["Pizza", "Sushi", "Burger"], (
        f"Options must keep the request order: {payload}"
    )
    assert [option["position"] for option in payload["options"]] == [0, 1, 2], (
        f"Options must get positions 0,1,2: {payload}"
    )
    for option in payload["options"]:
        assert isinstance(option["id"], int), f"Option ids must be numbers: {payload}"

    conflict = create_poll(alice["session"], poll_slug, "Again?", ["Pizza", "Sushi"])
    assert conflict.status_code == 409, (
        f"Duplicate slug must return 409, got {conflict.status_code}: {conflict.text}"
    )
    assert conflict.json() == {"error": "SLUG_TAKEN"}, f"Unexpected conflict body: {conflict.text}"

    other_conflict = create_poll(users["bob"]["session"], poll_slug, "Mine now", ["A", "B"])
    assert other_conflict.status_code == 409, (
        "A different user must also get 409 for an existing slug, got "
        f"{other_conflict.status_code}: {other_conflict.text}"
    )


def test_public_results_endpoint(users):
    poll_slug = slug("lunch")
    results = get_results_ok(poll_slug)
    assert results["slug"] == poll_slug, f"Unexpected slug in results: {results}"
    assert results["question"] == "Where do we eat?", f"Unexpected question in results: {results}"
    assert results["isClosed"] is False, f"Poll must be open: {results}"
    assert results["revision"] == 0, f"Poll without mutations must be at revision 0: {results}"
    assert results["totalVotes"] == 0, f"Poll without votes must report 0 total votes: {results}"
    assert results["leaderOptionId"] is None, f"Poll without votes has no leader: {results}"
    assert [option["position"] for option in results["options"]] == [0, 1, 2], (
        f"Results options must be ordered by position: {results}"
    )
    for option in results["options"]:
        assert option["votes"] == 0, f"Option should have no votes: {results}"
        assert option["voters"] == [], f"Option should have no voters: {results}"

    missing = get_results(slug("nope"))
    assert missing.status_code == 404, (
        f"Unknown poll must return 404, got {missing.status_code}: {missing.text}"
    )
    assert missing.json() == {"error": "POLL_NOT_FOUND"}, f"Unexpected 404 body: {missing.text}"


# --------------------------------------------------------------------------------------
# WebSocket protocol tests
# --------------------------------------------------------------------------------------


def test_socket_rejects_unauthenticated_connections(users, clients):
    anonymous = clients(None, "anonymous")
    anonymous.emit("poll:subscribe", {"slug": slug("lunch")})
    anonymous.expect_error("UNAUTHENTICATED")
    assert anonymous.states.empty(), "An unauthenticated connection must not receive poll state."


def test_socket_error_precedence_and_payload_validation(users, clients):
    alice = clients(users["alice"]["session"], "alice")
    other_slug = slug("other")
    other_poll = create_poll_ok(users["alice"]["session"], other_slug, "Other poll", ["X", "Y"])

    alice.emit("poll:subscribe", {})
    alice.expect_error("INVALID_PAYLOAD")

    alice.emit("poll:subscribe", {"slug": slug("nope")})
    alice.expect_error("POLL_NOT_FOUND")

    lunch_slug = slug("lunch")
    lunch = get_results_ok(lunch_slug)
    pizza_id = option_by_label(lunch, "Pizza")["id"]

    alice.emit("poll:vote", {"slug": lunch_slug, "optionId": pizza_id})
    alice.expect_error("NOT_SUBSCRIBED")

    alice.emit("poll:vote", {"slug": lunch_slug, "optionId": "pizza"})
    alice.expect_error("INVALID_PAYLOAD")

    state = alice.subscribe(lunch_slug)
    assert_state_shape(state, lunch_slug)
    assert state["revision"] == 0, f"Subscribing must not change the poll: {state}"
    assert state["totalVotes"] == 0, f"Poll has no votes yet: {state}"
    assert state["myVoteOptionId"] is None, f"Alice has no vote in this poll yet: {state}"
    assert state["leaderOptionId"] is None, f"Poll without votes has no leader: {state}"

    foreign_option_id = option_by_label(other_poll, "X")["id"]
    alice.emit("poll:vote", {"slug": lunch_slug, "optionId": foreign_option_id})
    alice.expect_error("OPTION_NOT_FOUND")

    alice.emit("poll:retract", {"slug": lunch_slug})
    alice.expect_error("NO_ACTIVE_VOTE")

    assert get_results_ok(lunch_slug)["revision"] == 0, (
        "Rejected socket requests must not change the poll revision."
    )
    assert alice.states.empty(), "Rejected socket requests must not emit poll state."


def test_voting_broadcast_personalization_and_tie_break(users, clients):
    poll_slug = slug("vote")
    poll = create_poll_ok(
        users["alice"]["session"], poll_slug, "Dinner?", ["Pizza", "Sushi", "Burger"]
    )
    pizza = option_by_label(poll, "Pizza")["id"]
    sushi = option_by_label(poll, "Sushi")["id"]

    alice = clients(users["alice"]["session"], "alice")
    bob = clients(users["bob"]["session"], "bob")
    carol = clients(users["carol"]["session"], "carol")
    for client in (alice, bob, carol):
        client.subscribe(poll_slug)

    alice.emit("poll:vote", {"slug": poll_slug, "optionId": pizza})
    alice_state = alice.next_state()
    bob_state = bob.next_state()
    carol_state = carol.next_state()
    for state in (alice_state, bob_state, carol_state):
        assert_state_shape(state, poll_slug)
        assert state["revision"] == 1, f"First accepted vote must bump revision to 1: {state}"
        assert state["totalVotes"] == 1, f"Poll must report a single vote: {state}"
        assert state["leaderOptionId"] == pizza, f"Pizza must lead: {state}"
        pizza_option = [o for o in state["options"] if o["id"] == pizza][0]
        assert pizza_option["votes"] == 1, f"Pizza must have one vote: {state}"
        assert pizza_option["voters"] == [users["alice"]["name"]], f"Unexpected voters: {state}"
    assert alice_state["myVoteOptionId"] == pizza, f"Alice must see her own vote: {alice_state}"
    assert bob_state["myVoteOptionId"] is None, f"Bob has no vote yet: {bob_state}"
    assert carol_state["myVoteOptionId"] is None, f"Carol has no vote yet: {carol_state}"

    bob.emit("poll:vote", {"slug": poll_slug, "optionId": sushi})
    states = [client.next_state() for client in (alice, bob, carol)]
    for state in states:
        assert state["revision"] == 2, f"Second accepted vote must bump revision to 2: {state}"
        assert state["totalVotes"] == 2, f"Poll must report two votes: {state}"
        assert state["leaderOptionId"] == pizza, (
            f"A 1-1 tie must be won by the smaller position (Pizza): {state}"
        )

    carol.emit("poll:vote", {"slug": poll_slug, "optionId": sushi})
    states = [client.next_state() for client in (alice, bob, carol)]
    for state in states:
        assert state["revision"] == 3, f"Third accepted vote must bump revision to 3: {state}"
        assert state["leaderOptionId"] == sushi, f"Sushi must lead with 2 votes: {state}"
        sushi_option = [o for o in state["options"] if o["id"] == sushi][0]
        assert sushi_option["voters"] == [users["bob"]["name"], users["carol"]["name"]], (
            f"Voters must be sorted ascending: {state}"
        )

    # Repeating the same vote is a no-op that is only echoed to the requesting connection.
    alice.emit("poll:vote", {"slug": poll_slug, "optionId": pizza})
    echoed = alice.next_state()
    assert echoed["revision"] == 3, f"A repeated vote must not bump the revision: {echoed}"
    assert echoed["myVoteOptionId"] == pizza, f"Alice still votes for Pizza: {echoed}"
    bob.expect_silence(2.0)
    carol.expect_silence(2.0)

    # Switching a vote moves it.
    alice.emit("poll:vote", {"slug": poll_slug, "optionId": sushi})
    states = [client.next_state() for client in (alice, bob, carol)]
    for state in states:
        assert state["revision"] == 4, f"Switching a vote must bump the revision: {state}"
        assert state["totalVotes"] == 3, f"Switching a vote keeps the total at 3: {state}"
        pizza_option = [o for o in state["options"] if o["id"] == pizza][0]
        sushi_option = [o for o in state["options"] if o["id"] == sushi][0]
        assert pizza_option["votes"] == 0 and pizza_option["voters"] == [], (
            f"Pizza must have lost Alice's vote: {state}"
        )
        assert sushi_option["votes"] == 3, f"Sushi must now hold three votes: {state}"
        assert sushi_option["voters"] == [
            users["alice"]["name"],
            users["bob"]["name"],
            users["carol"]["name"],
        ], f"Voters must be sorted ascending: {state}"
    assert states[0]["myVoteOptionId"] == sushi, f"Alice must see her moved vote: {states[0]}"

    # Retracting removes it.
    alice.emit("poll:retract", {"slug": poll_slug})
    states = [client.next_state() for client in (alice, bob, carol)]
    for state in states:
        assert state["revision"] == 5, f"Retracting must bump the revision: {state}"
        assert state["totalVotes"] == 2, f"Retracting must lower the total to 2: {state}"
    assert states[0]["myVoteOptionId"] is None, f"Alice must have no vote left: {states[0]}"

    results = get_results_ok(poll_slug)
    assert results["revision"] == 5, f"HTTP results must agree with the socket state: {results}"
    assert results["totalVotes"] == 2, f"HTTP results must agree with the socket state: {results}"
    assert results["leaderOptionId"] == sushi, f"HTTP results must report the leader: {results}"


def test_subscription_scoping_and_unsubscribe(users, clients):
    poll_slug = slug("scope")
    other_slug = slug("scope-other")
    poll = create_poll_ok(users["alice"]["session"], poll_slug, "Scoped?", ["A", "B"])
    create_poll_ok(users["alice"]["session"], other_slug, "Elsewhere?", ["A", "B"])
    option_a = option_by_label(poll, "A")["id"]
    option_b = option_by_label(poll, "B")["id"]

    alice = clients(users["alice"]["session"], "alice")
    bob = clients(users["bob"]["session"], "bob")
    carol = clients(users["carol"]["session"], "carol")

    alice.subscribe(poll_slug)
    bob.subscribe(poll_slug)
    carol.subscribe(other_slug)

    alice.emit("poll:vote", {"slug": poll_slug, "optionId": option_a})
    alice.next_state()
    bob.next_state()
    carol.expect_silence(2.0)

    bob.emit("poll:unsubscribe", {"slug": poll_slug})
    bob.expect_silence(2.0)

    alice.emit("poll:vote", {"slug": poll_slug, "optionId": option_b})
    moved = alice.next_state()
    assert moved["revision"] == 2, f"Switching Alice's vote must bump the revision: {moved}"
    bob.expect_silence(2.0)
    carol.expect_silence(2.0)


def test_multiple_connections_of_one_user_and_reconnect(users, clients):
    poll_slug = slug("multi")
    poll = create_poll_ok(users["alice"]["session"], poll_slug, "Multi?", ["A", "B"])
    option_a = option_by_label(poll, "A")["id"]

    first = clients(users["bob"]["session"], "bob-1")
    first.subscribe(poll_slug)
    first.emit("poll:vote", {"slug": poll_slug, "optionId": option_a})
    first.next_state()

    second = clients(users["bob"]["session"], "bob-2")
    state = second.subscribe(poll_slug)
    assert state["myVoteOptionId"] == option_a, (
        f"A fresh connection of the same user must see the stored vote: {state}"
    )
    assert state["revision"] == 1, f"Subscribing must not change the revision: {state}"

    third = clients(users["carol"]["session"], "carol")
    third.subscribe(poll_slug)
    third.drain()

    first.drain()
    second.drain()
    third.emit("poll:vote", {"slug": poll_slug, "optionId": option_a})
    for client in (first, second, third):
        state = client.next_state()
        assert state["revision"] == 2, f"{client.label}: expected revision 2, got {state}"
        assert state["totalVotes"] == 2, f"{client.label}: expected two votes, got {state}"
    assert first.states.empty() and second.states.empty(), (
        "Each subscribed connection must receive exactly one state per accepted mutation."
    )


def test_close_poll_permissions_and_closed_behaviour(users, clients):
    poll_slug = slug("close")
    poll = create_poll_ok(users["alice"]["session"], poll_slug, "Close me?", ["Yes", "No"])
    yes_option = option_by_label(poll, "Yes")["id"]

    alice = clients(users["alice"]["session"], "alice")
    bob = clients(users["bob"]["session"], "bob")
    alice.subscribe(poll_slug)
    bob.subscribe(poll_slug)

    bob.emit("poll:vote", {"slug": poll_slug, "optionId": yes_option})
    alice.next_state()
    bob.next_state()

    bob.emit("poll:close", {"slug": poll_slug})
    bob.expect_error("NOT_POLL_CREATOR")
    assert get_results_ok(poll_slug)["isClosed"] is False, (
        "A non-creator must not be able to close the poll."
    )

    alice.emit("poll:close", {"slug": poll_slug})
    for client in (alice, bob):
        state = client.next_state()
        assert state["isClosed"] is True, f"{client.label}: poll must be closed: {state}"
        assert state["revision"] == 2, f"{client.label}: closing must bump the revision: {state}"

    bob.emit("poll:vote", {"slug": poll_slug, "optionId": yes_option})
    bob.expect_error("POLL_CLOSED")
    bob.emit("poll:retract", {"slug": poll_slug})
    bob.expect_error("POLL_CLOSED")
    alice.emit("poll:close", {"slug": poll_slug})
    alice.expect_error("ALREADY_CLOSED")

    results = get_results_ok(poll_slug)
    assert results["isClosed"] is True, f"Poll must stay closed: {results}"
    assert results["revision"] == 2, f"Rejected requests must not bump the revision: {results}"
    assert results["totalVotes"] == 1, f"The vote cast before closing must remain: {results}"


# --------------------------------------------------------------------------------------
# Concurrency
# --------------------------------------------------------------------------------------


def test_concurrent_votes_are_all_counted(start_app, users):
    poll_slug = slug("race")
    poll = create_poll_ok(users["alice"]["session"], poll_slug, "Race?", ["A", "B"])
    option_a = option_by_label(poll, "A")["id"]
    option_b = option_by_label(poll, "B")["id"]

    names = [f"racer{index}{SUFFIX}" for index in range(8)]
    sessions = [make_user(name) for name in names]
    voters = []
    try:
        for index, session in enumerate(sessions):
            client = PollClient(session, f"racer{index}")
            client.subscribe(poll_slug)
            client.drain()
            voters.append(client)

        barrier = threading.Barrier(len(voters))

        def cast(index):
            client = voters[index]
            option = option_a if index % 2 == 0 else option_b
            barrier.wait(timeout=30)
            client.emit("poll:vote", {"slug": poll_slug, "optionId": option})
            client.next_state(timeout=30)

        started = time.time()
        with ThreadPoolExecutor(max_workers=len(voters)) as pool:
            list(pool.map(cast, range(len(voters))))
        assert time.time() - started < 60, "Concurrent voting took unexpectedly long."

        deadline = time.time() + 20
        results = get_results_ok(poll_slug)
        while results["totalVotes"] != 8 and time.time() < deadline:
            time.sleep(0.5)
            results = get_results_ok(poll_slug)

        assert results["totalVotes"] == 8, f"All eight concurrent votes must count: {results}"
        assert results["revision"] == 8, (
            f"Every accepted mutation must bump the revision exactly once: {results}"
        )
        counts = {option["id"]: option["votes"] for option in results["options"]}
        assert counts[option_a] == 4, f"Option A must hold four votes: {results}"
        assert counts[option_b] == 4, f"Option B must hold four votes: {results}"
        all_voters = sorted(
            [voter for option in results["options"] for voter in option["voters"]]
        )
        assert all_voters == sorted(names), f"Every racer must appear exactly once: {results}"
    finally:
        for client in voters:
            client.close()


def test_concurrent_votes_of_one_user_keep_a_single_vote(start_app, users):
    poll_slug = slug("switch")
    poll = create_poll_ok(users["alice"]["session"], poll_slug, "Switch?", ["A", "B"])
    option_a = option_by_label(poll, "A")["id"]
    option_b = option_by_label(poll, "B")["id"]

    name = f"switcher{SUFFIX}"
    session = make_user(name)
    client = PollClient(session, "switcher")
    try:
        client.subscribe(poll_slug)
        client.drain()
        barrier = threading.Barrier(5)

        def cast(index):
            barrier.wait(timeout=30)
            client.emit(
                "poll:vote",
                {"slug": poll_slug, "optionId": option_a if index % 2 == 0 else option_b},
            )

        with ThreadPoolExecutor(max_workers=5) as pool:
            list(pool.map(cast, range(5)))
        time.sleep(5)

        results = get_results_ok(poll_slug)
        assert results["totalVotes"] == 1, (
            f"A single user must never hold more than one vote in a poll: {results}"
        )
        holders = [
            option["id"] for option in results["options"] if name in option["voters"]
        ]
        assert holders in ([option_a], [option_b]), (
            f"The user must appear in exactly one voters list: {results}"
        )
        rows = query_db(
            'SELECT COUNT(*) FROM "Vote" v JOIN "Poll" p ON p.id = v."pollId" '
            'JOIN "User" u ON u.id = v."userId" WHERE p.slug = ?',
            (poll_slug,),
        )
        assert rows[0][0] == 1, (
            f"Exactly one Vote row must exist for {poll_slug}, found {rows[0][0]}."
        )
    finally:
        client.close()


# --------------------------------------------------------------------------------------
# Database state
# --------------------------------------------------------------------------------------


def find_database_path():
    candidates = []
    for pattern in (
        os.path.join(PROJECT_DIR, "*.db"),
        os.path.join(PROJECT_DIR, ".wasp", "out", "**", "*.db"),
        os.path.join(PROJECT_DIR, "db", "**", "*.db"),
        os.path.join(PROJECT_DIR, "migrations", "**", "*.db"),
    ):
        candidates.extend(glob.glob(pattern, recursive=True))
    matches = []
    for path in sorted(set(candidates)):
        try:
            connection = sqlite3.connect(f"file:{path}?mode=ro", uri=True, timeout=10)
            names = {
                row[0]
                for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")
            }
            connection.close()
        except sqlite3.Error:
            continue
        if {"Poll", "PollOption", "Vote"}.issubset(names):
            matches.append(path)
    assert matches, (
        "Could not find a SQLite database under /home/user/app containing the tables "
        f"Poll, PollOption and Vote (inspected: {sorted(set(candidates))})."
    )
    return matches[0]


def query_db(sql, params=()):
    path = find_database_path()
    last_error = None
    for _ in range(5):
        try:
            connection = sqlite3.connect(f"file:{path}?mode=ro", uri=True, timeout=10)
            try:
                return list(connection.execute(sql, params))
            finally:
                connection.close()
        except sqlite3.Error as error:  # pragma: no cover - retry on transient locks
            last_error = error
            time.sleep(1)
    raise AssertionError(f"Could not read the application database at {path}: {last_error}")


def unique_index_column_sets(table):
    path = find_database_path()
    connection = sqlite3.connect(f"file:{path}?mode=ro", uri=True, timeout=10)
    try:
        column_sets = []
        for row in connection.execute(f'PRAGMA index_list("{table}")'):
            index_name, is_unique = row[1], row[2]
            if not is_unique:
                continue
            columns = [entry[2] for entry in connection.execute(f'PRAGMA index_info("{index_name}")')]
            column_sets.append(set(columns))
        return column_sets
    finally:
        connection.close()


def test_database_enforces_unique_constraints(start_app, users):
    vote_indexes = unique_index_column_sets("Vote")
    assert {"pollId", "userId"} in vote_indexes, (
        "Vote must have a database-level unique constraint over (pollId, userId); "
        f"found unique indexes over {vote_indexes}."
    )
    option_indexes = unique_index_column_sets("PollOption")
    assert {"pollId", "position"} in option_indexes, (
        "PollOption must have a database-level unique constraint over (pollId, position); "
        f"found unique indexes over {option_indexes}."
    )


def test_database_rows_match_reported_results(start_app, users):
    poll_slug = slug("vote")
    results = get_results_ok(poll_slug)

    stored = query_db('SELECT revision, "isClosed" FROM "Poll" WHERE slug = ?', (poll_slug,))
    assert stored, f"No Poll row stored for slug {poll_slug}."
    assert stored[0][0] == results["revision"], (
        f"Stored revision {stored[0][0]} differs from the reported revision {results['revision']}."
    )

    rows = query_db(
        'SELECT v."optionId", COUNT(*) FROM "Vote" v JOIN "Poll" p ON p.id = v."pollId" '
        'WHERE p.slug = ? GROUP BY v."optionId"',
        (poll_slug,),
    )
    stored_counts = {option_id: count for option_id, count in rows}
    reported_counts = {
        option["id"]: option["votes"] for option in results["options"] if option["votes"] > 0
    }
    assert stored_counts == reported_counts, (
        f"Stored votes {stored_counts} do not match the reported votes {reported_counts}."
    )
    total_rows = query_db(
        'SELECT COUNT(*) FROM "Vote" v JOIN "Poll" p ON p.id = v."pollId" WHERE p.slug = ?',
        (poll_slug,),
    )
    assert total_rows[0][0] == results["totalVotes"], (
        f"Stored vote count {total_rows[0][0]} differs from reported total {results['totalVotes']}."
    )


# --------------------------------------------------------------------------------------
# Browser checks
# --------------------------------------------------------------------------------------


@pytest.fixture(scope="session")
def browser(start_app):
    from playwright.sync_api import sync_playwright

    with sync_playwright() as playwright:
        instance = playwright.chromium.launch(args=["--no-sandbox"])
        yield instance
        instance.close()


def wait_for_login_page(page, timeout=90):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if "/login" in page.url:
            return
        # NOTE: page.wait_for_timeout keeps pumping Playwright events, plain sleeps do not.
        page.wait_for_timeout(500)
    raise AssertionError(
        f"Expected an unauthenticated visitor to end up on /login, but the URL is {page.url}"
    )


def browser_login(page, name):
    page.goto(f"{CLIENT_URL}/login", wait_until="domcontentloaded")
    page.wait_for_selector("[data-testid=login-username]", timeout=120000)
    page.fill("[data-testid=login-username]", name)
    page.fill("[data-testid=login-password]", PASSWORD)
    page.click("[data-testid=login-submit]")
    # Give the login request time to finish and to store the session before navigating away.
    deadline = time.time() + 60
    while time.time() < deadline:
        try:
            stored = page.evaluate("() => window.localStorage.length > 0")
        except Exception:
            stored = False
        if stored or "/login" not in page.url:
            break
        page.wait_for_timeout(500)
    page.wait_for_timeout(2000)


def test_browser_requires_login_and_renders_live_results(users, browser, clients):
    from playwright.sync_api import expect

    poll_slug = slug("ui")
    poll = create_poll_ok(users["alice"]["session"], poll_slug, "Team lunch?", ["Pizza", "Sushi"])
    pizza = option_by_label(poll, "Pizza")["id"]
    sushi = option_by_label(poll, "Sushi")["id"]
    poll_url = f"{CLIENT_URL}/poll/{poll_slug}"

    context = browser.new_context()
    page = context.new_page()
    try:
        # Warm up the development client so the first compile does not race with the checks.
        page.goto(f"{CLIENT_URL}/login", wait_until="domcontentloaded")
        page.wait_for_selector("[data-testid=login-username]", timeout=180000)

        page.goto(poll_url, wait_until="domcontentloaded")
        wait_for_login_page(page)

        browser_login(page, users["alice"]["name"])

        deadline = time.time() + 120
        while True:
            page.goto(poll_url, wait_until="domcontentloaded")
            try:
                page.wait_for_selector("[data-testid=poll-question]", timeout=20000)
                break
            except Exception:
                if time.time() > deadline:
                    raise AssertionError(
                        "The poll page did not render for the logged-in user; the login page "
                        "must authenticate the user and keep the session."
                    )

        expect(page.get_by_test_id("poll-question")).to_have_text("Team lunch?", timeout=30000)
        expect(page.get_by_test_id("poll-status")).to_have_text("open", timeout=30000)
        expect(page.get_by_test_id("poll-total-votes")).to_have_text("0", timeout=30000)
        expect(page.get_by_test_id("poll-revision")).to_have_text("0", timeout=30000)
        expect(page.get_by_test_id("poll-my-vote")).to_have_text("none", timeout=30000)
        expect(page.get_by_test_id("poll-leader")).to_have_text("none", timeout=30000)
        expect(page.get_by_test_id(f"option-label-{pizza}")).to_have_text("Pizza", timeout=30000)
        expect(page.get_by_test_id(f"option-votes-{sushi}")).to_have_text("0", timeout=30000)

        page.get_by_test_id(f"option-vote-{pizza}").click()
        expect(page.get_by_test_id("poll-my-vote")).to_have_text(str(pizza), timeout=30000)
        expect(page.get_by_test_id("poll-total-votes")).to_have_text("1", timeout=30000)
        expect(page.get_by_test_id(f"option-votes-{pizza}")).to_have_text("1", timeout=30000)
        expect(page.get_by_test_id(f"option-voters-{pizza}")).to_have_text(
            users["alice"]["name"], timeout=30000
        )
        expect(page.get_by_test_id("poll-leader")).to_have_text(str(pizza), timeout=30000)
        expect(page.get_by_test_id("poll-revision")).to_have_text("1", timeout=30000)

        results = get_results_ok(poll_slug)
        assert results["totalVotes"] == 1, f"Clicking in the UI must cast a real vote: {results}"

        # A vote cast by somebody else must reach the open page without a reload.
        bob = clients(users["bob"]["session"], "bob")
        bob.subscribe(poll_slug)
        bob.emit("poll:vote", {"slug": poll_slug, "optionId": sushi})
        bob.next_state()

        expect(page.get_by_test_id("poll-total-votes")).to_have_text("2", timeout=30000)
        expect(page.get_by_test_id(f"option-votes-{sushi}")).to_have_text("1", timeout=30000)
        expect(page.get_by_test_id(f"option-voters-{sushi}")).to_have_text(
            users["bob"]["name"], timeout=30000
        )
        expect(page.get_by_test_id("poll-revision")).to_have_text("2", timeout=30000)

        page.get_by_test_id("poll-retract").click()
        expect(page.get_by_test_id("poll-my-vote")).to_have_text("none", timeout=30000)
        expect(page.get_by_test_id("poll-total-votes")).to_have_text("1", timeout=30000)
        expect(page.get_by_test_id("poll-revision")).to_have_text("3", timeout=30000)

        final_results = get_results_ok(poll_slug)
        assert final_results["totalVotes"] == 1, (
            f"Retracting in the UI must remove the stored vote: {final_results}"
        )

        page.goto(f"{CLIENT_URL}/poll/{slug('missing')}", wait_until="domcontentloaded")
        page.wait_for_selector("[data-testid=poll-missing]", timeout=30000)
        assert page.locator("[data-testid=poll-question]").count() == 0, (
            "A page for a non-existing poll must not render the poll elements."
        )
    finally:
        context.close()
