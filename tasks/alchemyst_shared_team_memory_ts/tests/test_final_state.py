import json
import os
import re
import subprocess

import pytest

PROJECT_DIR = "/home/user/myproject"
DIST_ENTRY = os.path.join(PROJECT_DIR, "dist", "main.js")


def _run_id() -> str:
    run_id = os.environ.get("ZEALT_RUN_ID")
    assert run_id, (
        "ZEALT_RUN_ID environment variable must be set during verification so the "
        "shared sessionId is namespaced per evaluation run."
    )
    return run_id


def _alice_content() -> str:
    return (
        f"ALICE_MARKER_{_run_id()}: Sprint X target is to deploy v3.0 of the "
        "analytics platform next Friday"
    )


def _bob_content() -> str:
    return (
        f"BOB_MARKER_{_run_id()}: The payment service has a critical blocker that "
        "requires escalation before release"
    )


def _run_cli(args, expect_success=True, env_overrides=None):
    env = os.environ.copy()
    if env_overrides is not None:
        env.update(env_overrides)
    result = subprocess.run(
        ["node", DIST_ENTRY, *args],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        env=env,
        timeout=120,
    )
    if expect_success:
        assert result.returncode == 0, (
            f"CLI invocation {args!r} failed with code {result.returncode}.\n"
            f"stdout: {result.stdout}\nstderr: {result.stderr}"
        )
    return result


@pytest.fixture(scope="session")
def built_project():
    """Ensure the CLI is built and dist/main.js exists before running tests."""
    assert os.path.isdir(PROJECT_DIR), (
        f"Expected project directory {PROJECT_DIR} to exist before verification."
    )
    if not os.path.isfile(DIST_ENTRY):
        # Try to (re)build the project from sources.
        if not os.path.isdir(os.path.join(PROJECT_DIR, "node_modules")):
            install = subprocess.run(
                ["npm", "install"],
                cwd=PROJECT_DIR,
                capture_output=True,
                text=True,
                timeout=600,
            )
            assert install.returncode == 0, (
                f"'npm install' failed in {PROJECT_DIR}:\n"
                f"stdout: {install.stdout}\nstderr: {install.stderr}"
            )
        build = subprocess.run(
            ["npm", "run", "build"],
            cwd=PROJECT_DIR,
            capture_output=True,
            text=True,
            timeout=600,
        )
        assert build.returncode == 0, (
            f"'npm run build' failed in {PROJECT_DIR}:\n"
            f"stdout: {build.stdout}\nstderr: {build.stderr}"
        )
    assert os.path.isfile(DIST_ENTRY), (
        f"Built entrypoint {DIST_ENTRY} does not exist after build."
    )
    return DIST_ENTRY


@pytest.fixture(scope="session")
def seeded_memories(built_project):
    """Seed the shared session with one memory per simulated user."""
    alice_content = _alice_content()
    bob_content = _bob_content()

    alice_add = _run_cli(["--user-id", "alice", "--add", alice_content])
    assert f"ADDED: {alice_content}" in alice_add.stdout, (
        "Expected an 'ADDED: <content>' confirmation line for alice's add. "
        f"Got stdout: {alice_add.stdout!r}"
    )

    bob_add = _run_cli(["--user-id", "bob", "--add", bob_content])
    assert f"ADDED: {bob_content}" in bob_add.stdout, (
        "Expected an 'ADDED: <content>' confirmation line for bob's add. "
        f"Got stdout: {bob_add.stdout!r}"
    )

    return {"alice": alice_content, "bob": bob_content}


def test_package_json_uses_alchemyst_sdk(built_project):
    pkg_path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(pkg_path), (
        f"Expected {pkg_path} to exist in the project."
    )
    with open(pkg_path) as f:
        pkg = json.load(f)
    deps = {}
    deps.update(pkg.get("dependencies") or {})
    deps.update(pkg.get("devDependencies") or {})
    assert "@alchemystai/sdk" in deps, (
        "package.json must declare '@alchemystai/sdk' as a dependency "
        f"(found dependencies: {list(deps.keys())})."
    )


def test_dist_entry_uses_real_sdk(built_project):
    """The built bundle must actually call Alchemyst memory APIs - no mocks."""
    sources = []
    for root, _dirs, files in os.walk(PROJECT_DIR):
        # Skip node_modules to keep things fast and meaningful.
        if "node_modules" in root.split(os.sep):
            continue
        for name in files:
            if name.endswith((".ts", ".js", ".mjs", ".cjs")):
                sources.append(os.path.join(root, name))
    combined = []
    for path in sources:
        try:
            with open(path, encoding="utf-8", errors="ignore") as f:
                combined.append(f.read())
        except OSError:
            continue
    blob = "\n".join(combined)
    assert "@alchemystai/sdk" in blob, (
        "Project sources or built bundle must import from '@alchemystai/sdk'."
    )
    assert re.search(r"memory\s*\.\s*add", blob), (
        "Project must call the Alchemyst memory add API (memory.add)."
    )
    assert re.search(r"memory\s*\.\s*search", blob), (
        "Project must call the Alchemyst memory search API (memory.search)."
    )
    assert "ZEALT_RUN_ID" in blob, (
        "Project must read the ZEALT_RUN_ID environment variable to namespace the shared sessionId."
    )


def test_alice_recalls_bobs_contribution(seeded_memories):
    result = _run_cli(
        ["--user-id", "alice", "--query", "what is blocking the release"]
    )
    memory_lines = [
        line for line in result.stdout.splitlines() if line.startswith("MEMORY: ")
    ]
    assert memory_lines, (
        "Expected at least one 'MEMORY: ...' line in alice's query output. "
        f"Got stdout: {result.stdout!r}"
    )
    bob_marker = f"BOB_MARKER_{_run_id()}"
    assert any(bob_marker in line for line in memory_lines), (
        f"Alice's shared-session query must surface Bob's contribution containing "
        f"{bob_marker!r}. Got MEMORY lines: {memory_lines!r}"
    )


def test_bob_recalls_alices_contribution(seeded_memories):
    result = _run_cli(
        ["--user-id", "bob", "--query", "what is the sprint deploy target"]
    )
    memory_lines = [
        line for line in result.stdout.splitlines() if line.startswith("MEMORY: ")
    ]
    assert memory_lines, (
        "Expected at least one 'MEMORY: ...' line in bob's query output. "
        f"Got stdout: {result.stdout!r}"
    )
    alice_marker = f"ALICE_MARKER_{_run_id()}"
    assert any(alice_marker in line for line in memory_lines), (
        f"Bob's shared-session query must surface Alice's contribution containing "
        f"{alice_marker!r}. Got MEMORY lines: {memory_lines!r}"
    )


def test_missing_user_id_reports_missing_parameters(built_project):
    result = _run_cli(["--query", "anything"], expect_success=False)
    assert result.returncode != 0, (
        "CLI invocation without --user-id must exit with a non-zero status."
        f" Got code: {result.returncode}, stdout: {result.stdout!r}, stderr: {result.stderr!r}"
    )
    combined = (result.stdout or "") + (result.stderr or "")
    assert "MISSING_PARAMETERS" in combined, (
        "CLI error message must contain 'MISSING_PARAMETERS' when --user-id is missing. "
        f"Got combined output: {combined!r}"
    )
