import json
import os
import subprocess

PROJECT_DIR = "/home/user/myproject"
ROUTER_PATH = os.path.join(PROJECT_DIR, "src", "router.ts")
CLI_PATH = os.path.join(PROJECT_DIR, "cli.ts")


def _run_cli(payload: dict) -> subprocess.CompletedProcess[str]:
    """Invoke the CLI by piping a JSON payload through stdin."""
    return subprocess.run(
        ["npx", "--no-install", "tsx", "cli.ts"],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        cwd=PROJECT_DIR,
        timeout=120,
    )


def _stdout_lines(stdout: str) -> list[str]:
    return [line for line in stdout.splitlines() if line.strip() != ""]


# ---------------------------------------------------------------------------
# Behavioural tests (cases 1-6 + default rejection + order preservation)
# ---------------------------------------------------------------------------


def test_all_six_cases_route_in_order():
    """Cases 1-6: each documented case produces the expected routed line."""
    payload = {
        "events": [
            "hello",
            42,
            ["a", "b", "c"],
            {"kind": "click", "target": {"type": "button", "id": "save"}},
            {
                "kind": "click",
                "target": {"type": "link", "href": "https://example.com/x"},
            },
            {
                "kind": "submit",
                "payload": {"formId": "signup", "valid": True},
            },
        ]
    }
    result = _run_cli(payload)
    assert result.returncode == 0, (
        f"CLI exited with non-zero code for all-match input: "
        f"stdout={result.stdout!r}, stderr={result.stderr!r}"
    )

    expected = [
        "text:5",
        "num:42",
        "list:3",
        "btn:save",
        "link:https://example.com/x",
        "submit:signup:true",
    ]
    lines = _stdout_lines(result.stdout)
    assert lines == expected, (
        f"Expected routed lines {expected!r}, got {lines!r} "
        f"(stderr={result.stderr!r})"
    )


def test_unmatched_event_triggers_err_after_previous_lines():
    """An unmatched event (kind:'hover') triggers `ERR` and earlier lines remain.

    Also confirms that no further events are routed after the rejection.
    """
    payload = {
        "events": [
            "hi",
            {"kind": "click", "target": {"type": "button", "id": "ok"}},
            {"kind": "hover"},
            99,
            {"kind": "submit", "payload": {"formId": "late", "valid": False}},
        ]
    }
    result = _run_cli(payload)
    assert result.returncode == 0, (
        f"CLI must exit 0 even on default rejection: "
        f"stdout={result.stdout!r}, stderr={result.stderr!r}"
    )

    lines = _stdout_lines(result.stdout)
    assert len(lines) == 3, (
        f"Expected exactly 3 non-empty stdout lines (two routed + one ERR), "
        f"got {len(lines)}: {lines!r}"
    )
    assert lines[0] == "text:2", (
        f"Expected first line to be 'text:2', got {lines[0]!r}"
    )
    assert lines[1] == "btn:ok", (
        f"Expected second line to be 'btn:ok', got {lines[1]!r}"
    )
    assert lines[2].startswith("ERR "), (
        f"Expected third line to begin with 'ERR ', got {lines[2]!r}"
    )
    assert len(lines[2]) > len("ERR "), (
        f"Expected non-empty diagnostic after 'ERR ', got {lines[2]!r}"
    )

    # No routed lines for events after the unmatched one should appear.
    forbidden_suffixes = ("num:99", "submit:late:false")
    for forbidden in forbidden_suffixes:
        for line in lines:
            assert forbidden not in line, (
                f"Found routed output for an event after the unmatched one: "
                f"{forbidden!r} appeared in {lines!r}"
            )


def test_output_preserves_input_order():
    """Output preserves the order of events in the input array."""
    payload = {
        "events": [
            {"kind": "submit", "payload": {"formId": "f1", "valid": False}},
            ["x", "y"],
            "abcd",
            {
                "kind": "click",
                "target": {"type": "link", "href": "https://arktype.io/docs"},
            },
            7,
            {"kind": "click", "target": {"type": "button", "id": "go"}},
        ]
    }
    result = _run_cli(payload)
    assert result.returncode == 0, (
        f"CLI exited with non-zero code: stdout={result.stdout!r}, "
        f"stderr={result.stderr!r}"
    )

    expected = [
        "submit:f1:false",
        "list:2",
        "text:4",
        "link:https://arktype.io/docs",
        "num:7",
        "btn:go",
    ]
    lines = _stdout_lines(result.stdout)
    assert lines == expected, (
        f"Expected routed lines (in order) {expected!r}, got {lines!r}"
    )


# ---------------------------------------------------------------------------
# Implementation-shape tests
# ---------------------------------------------------------------------------


def _read_router_source() -> str:
    assert os.path.isfile(ROUTER_PATH), (
        f"Expected router module at {ROUTER_PATH}."
    )
    with open(ROUTER_PATH, encoding="utf-8") as f:
        return f.read()


def test_router_uses_match_api():
    """The router source uses ArkType's `match(` API."""
    source = _read_router_source()
    assert "match(" in source, (
        "src/router.ts must construct the router via ArkType's `match(` API."
    )


def test_router_references_distinct_kind_literals():
    """The router source references at least two distinct `kind` literals."""
    source = _read_router_source()
    click_present = "'click'" in source or '"click"' in source
    submit_present = "'submit'" in source or '"submit"' in source
    assert click_present, (
        "src/router.ts must reference the 'click' kind literal."
    )
    assert submit_present, (
        "src/router.ts must reference the 'submit' kind literal."
    )


def test_cli_entrypoint_exists():
    """Sanity: the CLI entrypoint required by the acceptance criteria exists."""
    assert os.path.isfile(CLI_PATH), (
        f"Expected CLI entrypoint at {CLI_PATH}."
    )
