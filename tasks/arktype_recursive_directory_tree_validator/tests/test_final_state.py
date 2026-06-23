import json
import os
import re
import subprocess

PROJECT_DIR = "/home/user/myproject"
VALIDATOR_PATH = os.path.join(PROJECT_DIR, "src", "validator.ts")
CLI_PATH = os.path.join(PROJECT_DIR, "cli.ts")


def _run_cli(payload: dict | list) -> subprocess.CompletedProcess[str]:
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
# Behavioural tests (Criteria 1-4)
# ---------------------------------------------------------------------------


def test_valid_four_level_tree_is_accepted():
    """Criterion 1: a valid 4-level tree validates and is returned unchanged."""
    payload = {
        "name": "root",
        "children": [
            {
                "name": "src",
                "children": [
                    {
                        "name": "lib",
                        "children": [
                            {"name": "index.ts", "size": 1024}
                        ],
                    }
                ],
            }
        ],
    }

    result = _run_cli(payload)
    assert result.returncode == 0, (
        f"CLI exited with non-zero code for a valid tree: "
        f"stdout={result.stdout!r}, stderr={result.stderr!r}"
    )

    lines = _stdout_lines(result.stdout)
    assert lines and lines[0] == "VALID", (
        f"Expected first non-empty stdout line to be 'VALID', got: {lines!r} "
        f"(stderr={result.stderr!r})"
    )
    assert len(lines) >= 2, (
        f"Expected validated JSON tree on the line after VALID, got: {lines!r}"
    )

    try:
        validated = json.loads(lines[1])
    except json.JSONDecodeError as exc:
        raise AssertionError(
            f"Second stdout line is not valid JSON: {lines[1]!r} (error: {exc})"
        )

    assert validated.get("name") == "root", (
        f"Validated root name mismatch: {validated!r}"
    )
    leaf = (
        validated.get("children", [{}])[0]
        .get("children", [{}])[0]
        .get("children", [{}])[0]
    )
    assert leaf.get("name") == "index.ts", (
        f"Validated leaf name mismatch: {leaf!r}"
    )
    assert leaf.get("size") == 1024, (
        f"Validated leaf size mismatch: {leaf!r}"
    )


def test_missing_name_field_is_rejected():
    """Criterion 2: a node missing `name` must be rejected."""
    payload = {"children": [{"name": "a", "size": 10}]}
    result = _run_cli(payload)
    assert result.returncode == 0, (
        f"CLI exited with non-zero code: stdout={result.stdout!r}, "
        f"stderr={result.stderr!r}"
    )
    lines = _stdout_lines(result.stdout)
    assert lines and lines[0].startswith("INVALID:"), (
        f"Expected stdout to start with 'INVALID:' for missing name, got: "
        f"{result.stdout!r}"
    )


def test_file_node_with_children_is_rejected():
    """Criterion 3: a file node (with `size`) containing `children` is rejected."""
    payload = {
        "name": "root",
        "children": [
            {
                "name": "corrupted.txt",
                "size": 42,
                "children": [{"name": "x.txt", "size": 1}],
            }
        ],
    }
    result = _run_cli(payload)
    assert result.returncode == 0, (
        f"CLI exited with non-zero code: stdout={result.stdout!r}, "
        f"stderr={result.stderr!r}"
    )
    lines = _stdout_lines(result.stdout)
    assert lines and lines[0].startswith("INVALID:"), (
        f"Expected stdout to start with 'INVALID:' for file-with-children, "
        f"got: {result.stdout!r}"
    )


def test_empty_name_is_rejected():
    """Criterion 4: a node with name = '' must be rejected."""
    payload = {"name": "", "children": []}
    result = _run_cli(payload)
    assert result.returncode == 0, (
        f"CLI exited with non-zero code: stdout={result.stdout!r}, "
        f"stderr={result.stderr!r}"
    )
    lines = _stdout_lines(result.stdout)
    assert lines and lines[0].startswith("INVALID:"), (
        f"Expected stdout to start with 'INVALID:' for empty name, got: "
        f"{result.stdout!r}"
    )


# ---------------------------------------------------------------------------
# Implementation-shape tests (Criteria 5-6)
# ---------------------------------------------------------------------------


def _read_validator_source() -> str:
    assert os.path.isfile(VALIDATOR_PATH), (
        f"Expected validator module at {VALIDATOR_PATH}."
    )
    with open(VALIDATOR_PATH, encoding="utf-8") as f:
        return f.read()


def test_validator_exports_function():
    """Criterion 5 (part 1): src/validator.ts exports `validateDirectoryTree`."""
    source = _read_validator_source()
    pattern = re.compile(
        r"export\s+(?:async\s+)?(?:function|const|let|var)\s+validateDirectoryTree\b"
    )
    assert pattern.search(source), (
        "src/validator.ts must export a `validateDirectoryTree` symbol "
        "(e.g. `export function validateDirectoryTree` or "
        "`export const validateDirectoryTree`)."
    )


def test_validator_uses_assert_api():
    """Criterion 5 (part 2): the implementation uses ArkType's `.assert(...)`."""
    source = _read_validator_source()
    assert ".assert(" in source, (
        "src/validator.ts must use ArkType's `.assert(...)` API so that "
        "invalid input throws."
    )


def test_validator_uses_scope_export():
    """Criterion 6: the schema is built with `scope(...).export()`."""
    source = _read_validator_source()
    assert re.search(r"from\s+['\"]arktype['\"]", source), (
        "src/validator.ts must import from 'arktype'."
    )
    assert re.search(r"\bscope\b", source), (
        "src/validator.ts must use ArkType's `scope` to build the schema."
    )
    # `scope({...}).export()` — allow whitespace/newlines between scope(...) and .export()
    assert re.search(r"scope\s*\([\s\S]+?\)\s*\.\s*export\s*\(\s*\)", source), (
        "src/validator.ts must build the schema via `scope({...}).export()`."
    )


def test_cli_entrypoint_exists():
    """Sanity: the CLI entrypoint required by the acceptance criteria exists."""
    assert os.path.isfile(CLI_PATH), (
        f"Expected CLI entrypoint at {CLI_PATH}."
    )
