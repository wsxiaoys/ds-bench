import os
import re

import pytest


PROJECT_DIR = "/home/user/myproject"
LOG_FILE = os.path.join(PROJECT_DIR, "output.log")
SANDBOX_ID_REGEX = re.compile(r"^Sandbox ID:\s*(?P<id>[A-Za-z0-9-]+)\s*$", re.MULTILINE)


def _run_id() -> str:
    run_id = os.environ.get("ZEALT_RUN_ID")
    assert run_id is not None and run_id.strip() != "", (
        "ZEALT_RUN_ID must be set in the verifier environment to validate the run-scoped sandbox name."
    )
    return run_id


def _expected_name() -> str:
    return f"create-sandbox-ts-{_run_id()}"


def _read_sandbox_id_from_log() -> str:
    assert os.path.isfile(LOG_FILE), f"Expected log file at {LOG_FILE} to exist, but it was not found."
    with open(LOG_FILE, "r") as f:
        content = f.read()
    match = SANDBOX_ID_REGEX.search(content)
    assert match is not None, (
        f"Expected {LOG_FILE} to contain a line matching 'Sandbox ID: <id>', but got:\n{content!r}"
    )
    sandbox_id = match.group("id")
    assert len(sandbox_id) >= 8, (
        f"Captured sandbox id {sandbox_id!r} looks too short to be a real Daytona sandbox id."
    )
    return sandbox_id


@pytest.fixture(scope="session")
def daytona_client():
    from daytona import Daytona  # provided by `pip install daytona`

    api_key = os.environ.get("DAYTONA_API_KEY")
    assert api_key is not None and api_key.strip() != "", (
        "DAYTONA_API_KEY must be set in the verifier environment to query the Daytona SaaS."
    )
    # The Daytona() client auto-reads DAYTONA_API_KEY from the environment.
    return Daytona()


def test_log_file_contains_sandbox_id_line():
    """Acceptance Criterion: output.log must contain a 'Sandbox ID: <id>' line."""
    sandbox_id = _read_sandbox_id_from_log()
    assert sandbox_id, "Sandbox id captured from output.log is empty."


def test_sandbox_was_created_via_daytona_sdk(daytona_client):
    """Verify via the Daytona Python SDK that the sandbox really existed on Daytona.

    Because the task is required to delete the sandbox at the end, ``daytona.get`` may
    either return the sandbox record (in some terminal/archived state) or raise a
    not-found style exception. Both outcomes are accepted as proof that the script
    actually talked to the Daytona SaaS and created a real sandbox.
    """
    sandbox_id = _read_sandbox_id_from_log()
    expected_name = _expected_name()

    try:
        sandbox = daytona_client.get(sandbox_id)
    except Exception as exc:  # noqa: BLE001 — Daytona SDK can raise various error types on 404
        msg = str(exc).lower()
        not_found_markers = ("not found", "404", "no such", "does not exist")
        assert any(marker in msg for marker in not_found_markers), (
            f"daytona.get({sandbox_id!r}) raised an unexpected error: {exc!r}. "
            "Expected either a valid Sandbox object or a not-found style error."
        )
        return  # Sandbox already deleted; this is acceptable.

    actual_name = getattr(sandbox, "name", None)
    assert actual_name == expected_name, (
        f"Sandbox {sandbox_id} was retrieved from Daytona but its name is {actual_name!r}; "
        f"expected {expected_name!r} (suffixed by ZEALT_RUN_ID)."
    )


def test_sandbox_was_deleted_at_end(daytona_client):
    """Verify that no active sandbox remains for the expected name; the task must delete it.

    A stale entry with a terminal state is tolerated, but a still-running sandbox with the
    expected name indicates the task forgot to delete it.
    """
    expected_name = _expected_name()

    paginated = daytona_client.list()
    # The Python SDK returns either a list or a paginated object with `.items`.
    items = getattr(paginated, "items", paginated)

    active_matches = []
    for sb in items:
        name = getattr(sb, "name", None)
        if name != expected_name:
            continue
        state = getattr(sb, "state", "") or ""
        state_str = str(state).lower()
        # Anything that isn't a terminal/destroyed/archived state is considered active.
        terminal_markers = ("destroy", "archiv", "delet", "error", "stopped")
        is_terminal = any(marker in state_str for marker in terminal_markers)
        if not is_terminal:
            active_matches.append((getattr(sb, "id", "?"), state_str))

    assert not active_matches, (
        f"Expected the task to delete the sandbox named {expected_name!r}, but found active "
        f"sandboxes still present: {active_matches}"
    )


def test_cleanup_any_leftover_sandbox(daytona_client):
    """Best-effort cleanup: if any sandbox with the expected name is still present, delete it.

    This keeps the shared Daytona account clean even if the task or a previous verifier run
    failed to delete the sandbox.
    """
    expected_name = _expected_name()

    paginated = daytona_client.list()
    items = getattr(paginated, "items", paginated)

    for sb in items:
        if getattr(sb, "name", None) == expected_name:
            try:
                daytona_client.delete(sb)
            except Exception:
                # Already gone or terminal; ignore.
                pass
