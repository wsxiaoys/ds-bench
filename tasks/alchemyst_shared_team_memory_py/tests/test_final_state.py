import os
import subprocess

import pytest

PROJECT_DIR = "/home/user/myproject"
MAIN_PY = os.path.join(PROJECT_DIR, "main.py")

ALICE_PHRASE = "Alice prefers Python for data processing pipelines"
BOB_PHRASE = "Bob recommends PostgreSQL with TimescaleDB for time-series storage"


def _run_id():
    value = os.environ.get("ZEALT_RUN_ID")
    assert value, (
        "ZEALT_RUN_ID environment variable must be set in the verifier environment "
        "to scope shared memory resources."
    )
    return value


def _shared_ids():
    run_id = _run_id()
    return {
        "session": f"session-{run_id}",
        "alice": f"alice-{run_id}",
        "bob": f"bob-{run_id}",
    }


def _run_cli(user_id: str, query: str) -> subprocess.CompletedProcess:
    env = os.environ.copy()
    return subprocess.run(
        ["python3", "main.py", "--user-id", user_id, "--query", query],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        env=env,
        timeout=180,
    )


def _parse_retrieved_lines(stdout: str):
    """Return all snippet lines that start with '- ' after the RETRIEVED: header."""
    lines = stdout.splitlines()
    snippets = []
    in_retrieved = False
    for line in lines:
        stripped = line.rstrip()
        if stripped == "RETRIEVED:":
            in_retrieved = True
            continue
        if in_retrieved and stripped.startswith("- "):
            snippets.append(stripped[2:])
    return snippets


def test_main_py_exists():
    assert os.path.isfile(MAIN_PY), (
        f"Expected the CLI entrypoint at {MAIN_PY} but it was not found."
    )


def test_main_py_does_not_call_memory_search():
    """`client.v1.context.memory.search` does NOT exist in alchemystai==0.10.0."""
    with open(MAIN_PY, "r", encoding="utf-8") as f:
        source = f.read()
    assert "memory.search" not in source, (
        "main.py must NOT call `client.v1.context.memory.search`; that method does not "
        "exist in alchemystai==0.10.0. Use `client.v1.context.search` (or another "
        "real retrieval method documented in the v0.10.0 api.md) instead."
    )


def test_alice_view_of_shared_session():
    ids = _shared_ids()
    result = _run_cli(ids["alice"], "What technology choices have the team agreed on?")
    assert result.returncode == 0, (
        f"CLI exited with non-zero status when run as Alice. "
        f"stdout={result.stdout!r} stderr={result.stderr!r}"
    )
    stdout = result.stdout
    assert f"USER: {ids['alice']}" in stdout, (
        f"Expected stdout to contain `USER: {ids['alice']}`. Got:\n{stdout}"
    )
    assert f"SESSION: {ids['session']}" in stdout, (
        f"Expected stdout to contain `SESSION: {ids['session']}`. Got:\n{stdout}"
    )
    assert "RETRIEVED:" in stdout, (
        f"Expected stdout to contain a `RETRIEVED:` header line. Got:\n{stdout}"
    )
    snippets = _parse_retrieved_lines(stdout)
    assert snippets, (
        "Expected at least one snippet line starting with `- ` after `RETRIEVED:`. "
        f"Got stdout:\n{stdout}"
    )
    joined = "\n".join(snippets)
    assert ALICE_PHRASE in joined, (
        "Expected Alice's seeded memory phrase to appear in the retrieved snippets when "
        f"queried as Alice. Snippets:\n{joined}"
    )
    assert BOB_PHRASE in joined, (
        "Expected Bob's seeded memory phrase to also appear in the retrieved snippets "
        f"when queried as Alice (proving shared-session access). Snippets:\n{joined}"
    )


def test_bob_view_of_shared_session():
    ids = _shared_ids()
    result = _run_cli(ids["bob"], "Summarize the team decisions so far.")
    assert result.returncode == 0, (
        f"CLI exited with non-zero status when run as Bob. "
        f"stdout={result.stdout!r} stderr={result.stderr!r}"
    )
    stdout = result.stdout
    assert f"USER: {ids['bob']}" in stdout, (
        f"Expected stdout to contain `USER: {ids['bob']}`. Got:\n{stdout}"
    )
    assert f"SESSION: {ids['session']}" in stdout, (
        f"Expected stdout to contain `SESSION: {ids['session']}`. Got:\n{stdout}"
    )
    assert "RETRIEVED:" in stdout, (
        f"Expected stdout to contain a `RETRIEVED:` header line. Got:\n{stdout}"
    )
    snippets = _parse_retrieved_lines(stdout)
    assert snippets, (
        "Expected at least one snippet line starting with `- ` after `RETRIEVED:`. "
        f"Got stdout:\n{stdout}"
    )
    joined = "\n".join(snippets)
    assert ALICE_PHRASE in joined, (
        "Expected Alice's seeded memory phrase to appear in the retrieved snippets "
        f"when queried as Bob (proving shared-session access). Snippets:\n{joined}"
    )
    assert BOB_PHRASE in joined, (
        "Expected Bob's own seeded memory phrase to appear in the retrieved snippets "
        f"when queried as Bob. Snippets:\n{joined}"
    )


def test_cli_fails_without_api_key():
    ids = _shared_ids()
    env = os.environ.copy()
    env.pop("ALCHEMYST_AI_API_KEY", None)
    result = subprocess.run(
        ["python3", "main.py", "--user-id", ids["alice"], "--query", "ping"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        env=env,
        timeout=60,
    )
    assert result.returncode != 0, (
        "Expected the CLI to exit with a non-zero status when ALCHEMYST_AI_API_KEY is missing, "
        f"but it exited 0. stdout={result.stdout!r} stderr={result.stderr!r}"
    )
