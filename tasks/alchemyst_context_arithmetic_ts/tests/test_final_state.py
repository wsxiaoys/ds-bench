import json
import os
import subprocess

import pytest

PROJECT_DIR = "/home/user/myproject"
DIST_MAIN = os.path.join(PROJECT_DIR, "dist", "main.js")

ALL_KEYS = {"ENG_V1_DOC", "ENG_V2_DOC", "PRODUCT_V1_DOC", "PRODUCT_V2_DOC"}


def _run_cli(*groups):
    """Run `node dist/main.js --groups <groups...>` and return parsed JSON stdout."""
    assert os.path.isfile(DIST_MAIN), (
        f"Build artifact not found at {DIST_MAIN}. "
        f"Did `npm run build` succeed?"
    )
    cmd = ["node", DIST_MAIN, "--groups", *groups]
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        cwd=PROJECT_DIR,
        env=os.environ.copy(),
        timeout=300,
    )
    assert result.returncode == 0, (
        f"CLI exited with code {result.returncode}.\n"
        f"Command: {' '.join(cmd)}\n"
        f"STDOUT:\n{result.stdout}\n"
        f"STDERR:\n{result.stderr}"
    )
    stdout = result.stdout.strip()
    assert stdout, (
        f"CLI produced empty stdout.\n"
        f"Command: {' '.join(cmd)}\n"
        f"STDERR:\n{result.stderr}"
    )
    try:
        parsed = json.loads(stdout)
    except json.JSONDecodeError as exc:
        pytest.fail(
            f"CLI stdout is not valid JSON: {exc}\n"
            f"Command: {' '.join(cmd)}\n"
            f"STDOUT:\n{stdout}\n"
            f"STDERR:\n{result.stderr}"
        )
    assert isinstance(parsed, list), (
        f"Expected CLI stdout to be a JSON array, got {type(parsed).__name__}: {parsed!r}"
    )
    return parsed


def _key_set(items):
    keys = []
    for item in items:
        assert isinstance(item, dict), (
            f"Each result element must be a JSON object, got {type(item).__name__}: {item!r}"
        )
        assert "key" in item, f"Result element is missing required 'key' field: {item!r}"
        keys.append(item["key"])
    # Dedup check: each key appears at most once
    assert len(keys) == len(set(keys)), (
        f"Result array contains duplicate 'key' values: {keys}"
    )
    return set(keys)


@pytest.fixture(scope="session", autouse=True)
def build_project():
    """Install dependencies and build the TypeScript project once per session."""
    if not os.path.isdir(os.path.join(PROJECT_DIR, "node_modules")):
        result = subprocess.run(
            ["npm", "install"],
            capture_output=True,
            text=True,
            cwd=PROJECT_DIR,
            timeout=600,
        )
        assert result.returncode == 0, (
            f"`npm install` failed: {result.stderr}\nSTDOUT: {result.stdout}"
        )
    if not os.path.isfile(DIST_MAIN):
        result = subprocess.run(
            ["npm", "run", "build"],
            capture_output=True,
            text=True,
            cwd=PROJECT_DIR,
            timeout=600,
        )
        assert result.returncode == 0, (
            f"`npm run build` failed: {result.stderr}\nSTDOUT: {result.stdout}"
        )
    assert os.path.isfile(DIST_MAIN), (
        f"Expected build artifact at {DIST_MAIN} after `npm run build`."
    )


def test_intersection_eng_v1(build_project):
    items = _run_cli("eng", "v1")
    keys = _key_set(items)
    assert keys == {"ENG_V1_DOC"}, (
        f"Expected `--groups eng v1` to return exactly the ENG_V1_DOC document; got {keys}"
    )


def test_intersection_eng_v2(build_project):
    items = _run_cli("eng", "v2")
    keys = _key_set(items)
    assert keys == {"ENG_V2_DOC"}, (
        f"Expected `--groups eng v2` to return exactly the ENG_V2_DOC document; got {keys}"
    )


def test_single_group_eng(build_project):
    items = _run_cli("eng")
    keys = _key_set(items)
    assert keys == {"ENG_V1_DOC", "ENG_V2_DOC"}, (
        f"Expected `--groups eng` to return both engineering documents; got {keys}"
    )


def test_single_group_v1(build_project):
    items = _run_cli("v1")
    keys = _key_set(items)
    assert keys == {"ENG_V1_DOC", "PRODUCT_V1_DOC"}, (
        f"Expected `--groups v1` to return both v1 documents; got {keys}"
    )


def test_empty_intersection_eng_product(build_project):
    items = _run_cli("eng", "product")
    keys = _key_set(items)
    assert keys == set(), (
        f"Expected `--groups eng product` to return an empty array; got {keys}"
    )


def test_rerunnable_no_conflict(build_project):
    # Re-running with the same ZEALT_RUN_ID must succeed and yield the same result.
    items = _run_cli("eng", "v1")
    keys = _key_set(items)
    assert keys == {"ENG_V1_DOC"}, (
        f"Re-run of `--groups eng v1` did not return the expected ENG_V1_DOC; got {keys}"
    )
