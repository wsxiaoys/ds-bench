import json
import os
import subprocess

import pytest


PROJECT_DIR = "/home/user/myproject"
DIST_ENTRY = os.path.join(PROJECT_DIR, "dist", "main.js")


def _run_id():
    rid = os.environ.get("ZEALT_RUN_ID")
    assert rid, "ZEALT_RUN_ID must be set in the verifier environment."
    return rid


def _alchemyst_client():
    """Build a Python Alchemyst client for cleanup work after verification."""
    from alchemyst_ai import AlchemystAI

    api_key = os.environ.get("ALCHEMYST_AI_API_KEY")
    assert api_key, "ALCHEMYST_AI_API_KEY must be set in the verifier environment."
    return AlchemystAI(api_key=api_key)


def _best_effort_delete(client, file_name):
    """Delete a stored document by file_name; never raise."""
    # The Python SDK exposes context.delete; the exact signature varies
    # across versions, so we try a few common shapes.
    attempts = [
        lambda c: c.v1.context.delete(metadata={"file_name": file_name}),
        lambda c: c.v1.context.delete(metadata={"fileName": file_name}),
        lambda c: c.v1.context.delete(file_name=file_name),
    ]
    for fn in attempts:
        try:
            fn(client)
            return True
        except Exception:
            continue
    return False


def _run_cli(group):
    cmd = ["node", "dist/main.js", "--group", group]
    env = os.environ.copy()
    proc = subprocess.run(
        cmd,
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        env=env,
        timeout=300,
    )
    return proc


def _parse_json_array_from_stdout(stdout):
    """Parse the last non-empty line of stdout as a JSON array of strings."""
    lines = [line for line in stdout.splitlines() if line.strip()]
    assert lines, f"CLI produced no non-empty stdout lines. stdout={stdout!r}"
    last = lines[-1].strip()
    try:
        parsed = json.loads(last)
    except json.JSONDecodeError as exc:
        pytest.fail(
            f"Could not parse last stdout line as JSON: {last!r}. "
            f"Full stdout:\n{stdout}\nError: {exc!r}"
        )
    assert isinstance(parsed, list), (
        f"Expected a JSON array on the final stdout line, got: {type(parsed).__name__} {parsed!r}"
    )
    assert all(isinstance(x, str) for x in parsed), (
        f"Expected an array of strings, got: {parsed!r}"
    )
    return parsed


@pytest.fixture(scope="module")
def alchemyst_client():
    return _alchemyst_client()


@pytest.fixture(scope="module")
def support_results():
    """Cache the result of running the CLI for the support group."""
    proc = _run_cli("support")
    assert proc.returncode == 0, (
        f"`node dist/main.js --group support` exited with rc={proc.returncode}.\n"
        f"STDOUT:\n{proc.stdout}\nSTDERR:\n{proc.stderr}"
    )
    return _parse_json_array_from_stdout(proc.stdout), proc


@pytest.fixture(scope="module")
def engineering_results():
    """Cache the result of running the CLI for the engineering group."""
    proc = _run_cli("engineering")
    assert proc.returncode == 0, (
        f"`node dist/main.js --group engineering` exited with rc={proc.returncode}.\n"
        f"STDOUT:\n{proc.stdout}\nSTDERR:\n{proc.stderr}"
    )
    return _parse_json_array_from_stdout(proc.stdout), proc


@pytest.fixture(scope="module", autouse=True)
def _cleanup_after_verification(alchemyst_client, request):
    """Best-effort teardown to remove documents created by the CLI during verification."""
    yield
    collected = set()
    for name in ("support_results", "engineering_results"):
        try:
            value = request.getfixturevalue(name)
            file_names, _proc = value
            collected.update(file_names)
        except Exception:
            continue
    for fn in collected:
        _best_effort_delete(alchemyst_client, fn)


def test_dist_entry_exists():
    assert os.path.isfile(DIST_ENTRY), (
        f"Expected compiled CLI entry point at {DIST_ENTRY}. "
        "The agent must build the TypeScript project so this file exists."
    )
    assert os.path.getsize(DIST_ENTRY) > 0, (
        f"Compiled entry point {DIST_ENTRY} is empty."
    )


def test_support_search_returns_only_support_documents(support_results):
    file_names, proc = support_results
    rid = _run_id()
    assert len(file_names) == 2, (
        "Expected the filtered search for group 'support' to return exactly 2 "
        f"unique file_names, got {len(file_names)}: {file_names!r}.\n"
        f"STDOUT:\n{proc.stdout}\nSTDERR:\n{proc.stderr}"
    )
    assert len(set(file_names)) == len(file_names), (
        f"Expected file_names to be unique (deduplicated), got: {file_names!r}"
    )
    for name in file_names:
        assert rid in name, (
            f"Expected every returned file_name to be namespaced with the current "
            f"ZEALT_RUN_ID={rid!r}, but got {name!r}."
        )


def test_engineering_search_returns_only_engineering_documents(engineering_results):
    file_names, proc = engineering_results
    rid = _run_id()
    assert len(file_names) == 2, (
        "Expected the filtered search for group 'engineering' to return exactly 2 "
        f"unique file_names, got {len(file_names)}: {file_names!r}.\n"
        f"STDOUT:\n{proc.stdout}\nSTDERR:\n{proc.stderr}"
    )
    assert len(set(file_names)) == len(file_names), (
        f"Expected file_names to be unique (deduplicated), got: {file_names!r}"
    )
    for name in file_names:
        assert rid in name, (
            f"Expected every returned file_name to be namespaced with the current "
            f"ZEALT_RUN_ID={rid!r}, but got {name!r}."
        )


def test_group_results_are_disjoint(support_results, engineering_results):
    support_names, _ = support_results
    engineering_names, _ = engineering_results
    overlap = set(support_names) & set(engineering_names)
    assert not overlap, (
        "The metadata-filtered searches for 'support' and 'engineering' must "
        "return disjoint sets of file_names. Overlap suggests the CLI did not "
        "filter via groupName (camelCase) correctly on search. "
        f"Overlapping file_names: {sorted(overlap)!r}\n"
        f"support={support_names!r}\nengineering={engineering_names!r}"
    )


def test_cli_is_idempotent_on_rerun(support_results):
    """Re-running the CLI must not crash on 409 conflicts and must produce the
    same JSON array as the first invocation."""
    first_file_names, _ = support_results
    second_proc = _run_cli("support")
    assert second_proc.returncode == 0, (
        "Re-running `node dist/main.js --group support` must succeed (the "
        "agent's seeding step must handle 409 Conflict on existing file_names). "
        f"rc={second_proc.returncode}\n"
        f"STDOUT:\n{second_proc.stdout}\nSTDERR:\n{second_proc.stderr}"
    )
    second_file_names = _parse_json_array_from_stdout(second_proc.stdout)
    assert sorted(second_file_names) == sorted(first_file_names), (
        "Expected the second run to return the same set of file_names as the "
        f"first run. first={sorted(first_file_names)!r}, "
        f"second={sorted(second_file_names)!r}"
    )
