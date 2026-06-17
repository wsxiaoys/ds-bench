import json
import os
import re
import subprocess

PROJECT_DIR = "/home/user/myproject"
VALIDATOR_PATH = os.path.join(PROJECT_DIR, "src", "validator.ts")
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
# Behavioural tests (Criteria 1-6)
# ---------------------------------------------------------------------------


def test_valid_three_node_cyclic_graph_is_accepted():
    """Criterion 1: a valid 3-node graph with an A->B->C->A cycle validates."""
    payload = {
        "graph": {
            "rootId": 1,
            "nodes": [
                {"id": 1, "label": "A",
                 "edges": [{"id": 2, "label": "B", "edges": []}]},
                {"id": 2, "label": "B",
                 "edges": [{"id": 3, "label": "C", "edges": []}]},
                {"id": 3, "label": "C",
                 "edges": [{"id": 1, "label": "A", "edges": []}]},
            ],
        }
    }

    result = _run_cli(payload)
    assert result.returncode == 0, (
        f"CLI exited with non-zero code for a valid graph: "
        f"stdout={result.stdout!r}, stderr={result.stderr!r}"
    )

    lines = _stdout_lines(result.stdout)
    assert lines and lines[0] == "VALID", (
        f"Expected first non-empty stdout line to be 'VALID', got: {lines!r} "
        f"(stderr={result.stderr!r})"
    )
    assert len(lines) >= 2, (
        f"Expected validated graph JSON after VALID, got: {lines!r}"
    )

    try:
        validated = json.loads(lines[1])
    except json.JSONDecodeError as exc:
        raise AssertionError(
            f"Second stdout line is not valid JSON: {lines[1]!r} (error: {exc})"
        )

    assert validated.get("rootId") == 1, (
        f"Validated rootId mismatch: {validated!r}"
    )
    nodes = validated.get("nodes")
    assert isinstance(nodes, list) and len(nodes) == 3, (
        f"Validated nodes array mismatch: {validated!r}"
    )


def test_duplicate_node_id_is_rejected():
    """Criterion 2: a graph with two nodes sharing the same `id` is rejected."""
    payload = {
        "graph": {
            "rootId": 1,
            "nodes": [
                {"id": 1, "label": "A", "edges": []},
                {"id": 1, "label": "A again", "edges": []},
            ],
        }
    }
    result = _run_cli(payload)
    assert result.returncode == 0, (
        f"CLI exited with non-zero code: stdout={result.stdout!r}, "
        f"stderr={result.stderr!r}"
    )
    lines = _stdout_lines(result.stdout)
    assert lines and lines[0].startswith("INVALID:"), (
        f"Expected stdout to start with 'INVALID:' for duplicate id, got: "
        f"{result.stdout!r}"
    )


def test_edge_target_missing_in_nodes_is_rejected():
    """Criterion 3: a graph with an edge pointing to a missing id is rejected."""
    payload = {
        "graph": {
            "rootId": 1,
            "nodes": [
                {
                    "id": 1,
                    "label": "A",
                    "edges": [{"id": 999, "label": "ghost", "edges": []}],
                }
            ],
        }
    }
    result = _run_cli(payload)
    assert result.returncode == 0, (
        f"CLI exited with non-zero code: stdout={result.stdout!r}, "
        f"stderr={result.stderr!r}"
    )
    lines = _stdout_lines(result.stdout)
    assert lines and lines[0].startswith("INVALID:"), (
        f"Expected stdout to start with 'INVALID:' for missing edge target, "
        f"got: {result.stdout!r}"
    )


def test_negative_id_is_rejected():
    """Criterion 4: a graph that contains a node with a negative id is rejected."""
    payload = {
        "graph": {
            "rootId": 0,
            "nodes": [{"id": -1, "label": "bad", "edges": []}],
        }
    }
    result = _run_cli(payload)
    assert result.returncode == 0, (
        f"CLI exited with non-zero code: stdout={result.stdout!r}, "
        f"stderr={result.stderr!r}"
    )
    lines = _stdout_lines(result.stdout)
    assert lines and lines[0].startswith("INVALID:"), (
        f"Expected stdout to start with 'INVALID:' for negative id, got: "
        f"{result.stdout!r}"
    )


def test_label_length_41_is_rejected():
    """Criterion 5: a node whose label has length 41 is rejected."""
    payload = {
        "graph": {
            "rootId": 1,
            "nodes": [
                {"id": 1, "label": "a" * 41, "edges": []}
            ],
        }
    }
    result = _run_cli(payload)
    assert result.returncode == 0, (
        f"CLI exited with non-zero code: stdout={result.stdout!r}, "
        f"stderr={result.stderr!r}"
    )
    lines = _stdout_lines(result.stdout)
    assert lines and lines[0].startswith("INVALID:"), (
        f"Expected stdout to start with 'INVALID:' for label length 41, "
        f"got: {result.stdout!r}"
    )


def test_root_id_not_in_nodes_is_rejected():
    """Criterion 6: a graph whose rootId is not present in `nodes` is rejected."""
    payload = {
        "graph": {
            "rootId": 42,
            "nodes": [{"id": 1, "label": "only", "edges": []}],
        }
    }
    result = _run_cli(payload)
    assert result.returncode == 0, (
        f"CLI exited with non-zero code: stdout={result.stdout!r}, "
        f"stderr={result.stderr!r}"
    )
    lines = _stdout_lines(result.stdout)
    assert lines and lines[0].startswith("INVALID:"), (
        f"Expected stdout to start with 'INVALID:' when rootId missing from "
        f"nodes, got: {result.stdout!r}"
    )


# ---------------------------------------------------------------------------
# Implementation-shape tests (Criterion 7)
# ---------------------------------------------------------------------------


def _read_validator_source() -> str:
    assert os.path.isfile(VALIDATOR_PATH), (
        f"Expected validator module at {VALIDATOR_PATH}."
    )
    with open(VALIDATOR_PATH, encoding="utf-8") as f:
        return f.read()


def test_validator_exports_function():
    """Criterion 7 (part a): src/validator.ts exports `validateGraph`."""
    source = _read_validator_source()
    pattern = re.compile(
        r"export\s+(?:async\s+)?(?:function|const|let|var)\s+validateGraph\b"
    )
    assert pattern.search(source), (
        "src/validator.ts must export a `validateGraph` symbol "
        "(e.g. `export function validateGraph` or "
        "`export const validateGraph`)."
    )


def test_validator_uses_scope_export():
    """Criterion 7 (part b): the schema is built with `scope(...).export()`."""
    source = _read_validator_source()
    assert re.search(r"from\s+['\"]arktype['\"]", source), (
        "src/validator.ts must import from 'arktype'."
    )
    assert "scope(" in source, (
        "src/validator.ts must use ArkType's `scope(` to build the schema."
    )
    assert re.search(r"scope\s*\([\s\S]+?\)\s*\.\s*export\s*\(\s*\)", source), (
        "src/validator.ts must build the schema via `scope({...}).export()`."
    )


def test_validator_uses_narrow_predicate():
    """Criterion 7 (part c): at least one `.narrow(` predicate is attached."""
    source = _read_validator_source()
    assert ".narrow(" in source, (
        "src/validator.ts must attach at least one `.narrow(...)` predicate "
        "to express cross-node structural integrity constraints (unique ids, "
        "edge target existence, rootId existence)."
    )


def test_cli_entrypoint_exists():
    """Sanity: the CLI entrypoint required by the acceptance criteria exists."""
    assert os.path.isfile(CLI_PATH), (
        f"Expected CLI entrypoint at {CLI_PATH}."
    )
