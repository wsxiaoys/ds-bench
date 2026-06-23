import os
import re
import subprocess

import pytest

PROJECT_DIR = "/home/user/myproject"


def _run_cli(question: str):
    """Invoke the executor-built CLI with the given --question argument."""
    env = os.environ.copy()
    return subprocess.run(
        ["python3", "main.py", "--question", question],
        capture_output=True,
        text=True,
        cwd=PROJECT_DIR,
        env=env,
        timeout=120,
    )


def test_cli_main_file_exists():
    """The executor must have created the CLI entrypoint at main.py."""
    main_path = os.path.join(PROJECT_DIR, "main.py")
    assert os.path.isfile(main_path), (
        f"Expected the executor to create a CLI entrypoint at {main_path}."
    )


def test_refund_question_retrieves_policy_chunk():
    """
    Run the CLI with a refund-related question and verify the retrieved
    context chunk content is printed to stdout (case-insensitive match on
    a substring drawn from the ingested policy document).
    """
    proc = _run_cli("What is your refund policy?")
    assert proc.returncode == 0, (
        f"CLI exited with non-zero status {proc.returncode}.\n"
        f"stdout:\n{proc.stdout}\nstderr:\n{proc.stderr}"
    )
    combined = (proc.stdout or "") + "\n" + (proc.stderr or "")
    assert re.search(r"30[- ]?day", combined, re.IGNORECASE), (
        "Expected the retrieved context chunk content (containing '30-day') "
        "to be printed to stdout, but it was not found.\n"
        f"stdout:\n{proc.stdout}\nstderr:\n{proc.stderr}"
    )


def test_second_invocation_does_not_409():
    """
    Running the CLI a second time with the same arguments must not crash
    with an uncaught 409 Conflict. The second invocation must still
    produce a retrieval whose stdout contains the policy chunk.
    """
    proc = _run_cli("What is your refund policy?")
    assert proc.returncode == 0, (
        "Second invocation of the CLI failed. The CLI must remain idempotent "
        "across reruns (e.g., by using a unique file_name suffix from "
        "ZEALT_RUN_ID, by handling 409 Conflict, or by delete-then-add).\n"
        f"stdout:\n{proc.stdout}\nstderr:\n{proc.stderr}"
    )
    combined = (proc.stdout or "") + "\n" + (proc.stderr or "")
    assert re.search(r"30[- ]?day", combined, re.IGNORECASE), (
        "Second invocation did not retrieve the policy chunk containing '30-day'.\n"
        f"stdout:\n{proc.stdout}\nstderr:\n{proc.stderr}"
    )


def test_negative_control_question_does_not_crash():
    """A clearly unrelated question must run without an unhandled exception."""
    proc = _run_cli("How do I bake sourdough bread at home?")
    assert proc.returncode == 0, (
        "The CLI must not crash when no relevant context is retrieved.\n"
        f"stdout:\n{proc.stdout}\nstderr:\n{proc.stderr}"
    )


def test_main_py_does_not_hardcode_api_key():
    """
    The executor must read the API key from ALCHEMYST_AI_API_KEY rather than
    hardcoding it. Check that the CLI source does not embed the runtime value.
    """
    main_path = os.path.join(PROJECT_DIR, "main.py")
    with open(main_path, "r", encoding="utf-8", errors="ignore") as fh:
        source = fh.read()
    runtime_key = os.environ.get("ALCHEMYST_AI_API_KEY", "")
    if runtime_key:
        assert runtime_key not in source, (
            "The runtime ALCHEMYST_AI_API_KEY value appears to be hardcoded in main.py. "
            "Read it from the environment variable instead."
        )
    assert "ALCHEMYST_AI_API_KEY" in source, (
        "main.py should read the API key from the ALCHEMYST_AI_API_KEY environment variable."
    )
