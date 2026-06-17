import json
import os
import re
import subprocess

import pytest


PROJECT_DIR = "/home/user/myproject"
HANDLER_PATH = os.path.join(PROJECT_DIR, "src", "handler.ts")
PACKAGE_JSON_PATH = os.path.join(PROJECT_DIR, "package.json")


def _run_handler(payload: str) -> subprocess.CompletedProcess:
    """Invoke the handler via stdin and return the completed process."""
    return subprocess.run(
        ["npx", "tsx", "src/handler.ts"],
        input=payload,
        capture_output=True,
        text=True,
        cwd=PROJECT_DIR,
        timeout=180,
    )


def test_package_json_pins_arktype_2_2_0():
    assert os.path.isfile(PACKAGE_JSON_PATH), (
        f"package.json not found at {PACKAGE_JSON_PATH}"
    )
    with open(PACKAGE_JSON_PATH, "r") as f:
        pkg = json.load(f)
    deps = pkg.get("dependencies") or {}
    dev_deps = pkg.get("devDependencies") or {}
    merged = {**dev_deps, **deps}
    assert merged.get("arktype") == "2.2.0", (
        "Expected dependency `arktype` to be pinned at exactly 2.2.0 in package.json, "
        f"got: {merged.get('arktype')!r}"
    )


def test_handler_source_uses_match_api_and_default_assert():
    """Criteria #5 and #6: implementation uses match API with default: \"assert\"."""
    assert os.path.isfile(HANDLER_PATH), (
        f"Handler source not found at {HANDLER_PATH}"
    )
    with open(HANDLER_PATH, "r") as f:
        source = f.read()

    # Must import `match` from arktype.
    assert re.search(
        r"""import\s*\{[^}]*\bmatch\b[^}]*\}\s*from\s*['\"]arktype['\"]""",
        source,
    ), "handler.ts must import `match` from 'arktype'."

    # Must call match({...}) — the builder accepting a case-record object.
    assert re.search(r"\bmatch\s*\(\s*\{", source), (
        "handler.ts must invoke ArkType's match API with an object literal of cases "
        "(e.g., `match({...})`)."
    )

    # Must configure `default: \"assert\"`.
    assert re.search(
        r"""default\s*:\s*["']assert["']""",
        source,
    ), "The match definition must include `default: \"assert\"`."

    # Must NOT branch on `status` via if/else or switch to choose the return format.
    forbidden_if = re.search(
        r"""(?:if|else\s+if)\s*\([^)]*\bstatus\b[^)]*===?\s*['"](success|error|pending)['"]""",
        source,
    )
    assert forbidden_if is None, (
        "handler.ts must not branch on payload.status via if/else to select between "
        "OK/ERR/PENDING outputs; use ArkType's match API instead."
    )
    forbidden_switch = re.search(r"""switch\s*\(\s*[^)]*\bstatus\b""", source)
    assert forbidden_switch is None, (
        "handler.ts must not switch on payload.status to select between OK/ERR/PENDING "
        "outputs; use ArkType's match API instead."
    )


def test_success_payload_returns_ok_with_json_data():
    """Criterion #1: success payload returns a string starting with `OK:` containing JSON data."""
    payload = '{"status":"success","data":{"id":1,"name":"alice"}}'
    result = _run_handler(payload)
    assert result.returncode == 0, (
        f"Expected exit code 0 for success payload, got {result.returncode}. "
        f"stderr={result.stderr!r}"
    )
    out = result.stdout.strip()
    assert out.startswith("OK:"), (
        f"Expected stdout to start with 'OK:', got: {out!r}"
    )
    json_part = out[len("OK:"):].strip()
    try:
        parsed = json.loads(json_part)
    except json.JSONDecodeError as e:
        pytest.fail(
            f"Expected JSON-serialized data after 'OK:', could not parse {json_part!r}: {e}"
        )
    assert parsed == {"id": 1, "name": "alice"}, (
        f"Expected the JSON data after 'OK:' to equal {{'id': 1, 'name': 'alice'}}, "
        f"got: {parsed!r}"
    )


def test_error_payload_returns_err_code_reason():
    """Criterion #2: error payload returns `ERR <code> <reason>`."""
    payload = '{"status":"error","code":404,"reason":"not found"}'
    result = _run_handler(payload)
    assert result.returncode == 0, (
        f"Expected exit code 0 for error payload, got {result.returncode}. "
        f"stderr={result.stderr!r}"
    )
    out = result.stdout.strip()
    assert out == "ERR 404 not found", (
        f"Expected stdout to be exactly 'ERR 404 not found', got: {out!r}"
    )


def test_pending_payload_returns_pending_literal():
    """Criterion #3: pending payload returns the literal `PENDING`."""
    payload = '{"status":"pending"}'
    result = _run_handler(payload)
    assert result.returncode == 0, (
        f"Expected exit code 0 for pending payload, got {result.returncode}. "
        f"stderr={result.stderr!r}"
    )
    out = result.stdout.strip()
    assert out == "PENDING", (
        f"Expected stdout to be exactly 'PENDING', got: {out!r}"
    )


def test_unmatched_input_throws():
    """Criterion #4: unmatched input must throw (verified via non-zero exit code)."""
    payload = '{"status":"unknown"}'
    result = _run_handler(payload)
    assert result.returncode != 0, (
        "Expected a non-zero exit code when the matcher receives a payload that "
        "matches none of the declared branches (the matcher must throw because "
        "`default: \"assert\"` is set). "
        f"Got exit code 0 with stdout={result.stdout!r}"
    )
