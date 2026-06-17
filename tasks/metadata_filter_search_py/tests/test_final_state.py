import json
import os
import subprocess

import pytest

PROJECT_DIR = "/home/user/myproject"
GROUPS = ["support", "billing", "engineering"]


def _run_cli(group: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["python3", "main.py", "--group", group],
        capture_output=True,
        text=True,
        cwd=PROJECT_DIR,
        env=os.environ.copy(),
        timeout=180,
    )


def _parse_file_names(stdout: str) -> list:
    # Allow a possible trailing newline but stdout MUST be a single JSON array.
    text = stdout.strip()
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as exc:
        pytest.fail(
            f"CLI stdout is not valid JSON: {exc}. Raw stdout: {stdout!r}"
        )
    assert isinstance(parsed, list), (
        f"Expected CLI stdout to be a JSON array, got {type(parsed).__name__}: "
        f"{parsed!r}"
    )
    for item in parsed:
        assert isinstance(item, str), (
            f"Expected every element of the JSON array to be a string "
            f"file_name, got {item!r} (type {type(item).__name__})."
        )
    return parsed


@pytest.fixture(scope="module")
def run_id() -> str:
    value = os.environ.get("ZEALT_RUN_ID")
    assert value, (
        "ZEALT_RUN_ID must be set so we can verify file_name namespacing."
    )
    return value


@pytest.fixture(scope="module")
def group_results(run_id):
    """Run the CLI once per group and collect the returned file_name sets."""
    results = {}
    for group in GROUPS:
        proc = _run_cli(group)
        assert proc.returncode == 0, (
            f"`python3 main.py --group {group}` failed with exit code "
            f"{proc.returncode}. stderr: {proc.stderr!r}"
        )
        results[group] = set(_parse_file_names(proc.stdout))
    return results


def test_support_group_returns_only_support_documents(run_id, group_results):
    support = group_results["support"]
    billing = group_results["billing"]
    engineering = group_results["engineering"]

    assert len(support) >= 2, (
        f"Expected the support filter to return at least 2 file_name values, "
        f"got {len(support)}: {sorted(support)}"
    )
    for name in support:
        assert run_id in name, (
            f"Returned support file_name {name!r} does not include the "
            f"ZEALT_RUN_ID namespace {run_id!r}."
        )

    overlap_billing = support & billing
    overlap_engineering = support & engineering
    assert not overlap_billing, (
        f"Support filter results leaked billing-group file_names: "
        f"{sorted(overlap_billing)}"
    )
    assert not overlap_engineering, (
        f"Support filter results leaked engineering-group file_names: "
        f"{sorted(overlap_engineering)}"
    )


def test_billing_group_returns_only_billing_documents(run_id, group_results):
    support = group_results["support"]
    billing = group_results["billing"]
    engineering = group_results["engineering"]

    assert len(billing) >= 2, (
        f"Expected the billing filter to return at least 2 file_name values, "
        f"got {len(billing)}: {sorted(billing)}"
    )
    for name in billing:
        assert run_id in name, (
            f"Returned billing file_name {name!r} does not include the "
            f"ZEALT_RUN_ID namespace {run_id!r}."
        )

    overlap_support = billing & support
    overlap_engineering = billing & engineering
    assert not overlap_support, (
        f"Billing filter results leaked support-group file_names: "
        f"{sorted(overlap_support)}"
    )
    assert not overlap_engineering, (
        f"Billing filter results leaked engineering-group file_names: "
        f"{sorted(overlap_engineering)}"
    )


def test_engineering_group_returns_only_engineering_documents(run_id, group_results):
    support = group_results["support"]
    billing = group_results["billing"]
    engineering = group_results["engineering"]

    assert len(engineering) >= 2, (
        f"Expected the engineering filter to return at least 2 file_name "
        f"values, got {len(engineering)}: {sorted(engineering)}"
    )
    for name in engineering:
        assert run_id in name, (
            f"Returned engineering file_name {name!r} does not include the "
            f"ZEALT_RUN_ID namespace {run_id!r}."
        )

    overlap_support = engineering & support
    overlap_billing = engineering & billing
    assert not overlap_support, (
        f"Engineering filter results leaked support-group file_names: "
        f"{sorted(overlap_support)}"
    )
    assert not overlap_billing, (
        f"Engineering filter results leaked billing-group file_names: "
        f"{sorted(overlap_billing)}"
    )


def test_cli_is_rerunnable_without_conflict(run_id, group_results):
    """Re-running the CLI must not raise a 409 Conflict from duplicate file_names."""
    proc = _run_cli("support")
    assert proc.returncode == 0, (
        f"Rerun of `python3 main.py --group support` failed with exit "
        f"{proc.returncode}. stderr: {proc.stderr!r}"
    )
    rerun_names = set(_parse_file_names(proc.stdout))
    # Should still return only support-group file_names for this run-id
    assert rerun_names, "Rerun returned an empty file_name list."
    for name in rerun_names:
        assert run_id in name, (
            f"On rerun, returned file_name {name!r} does not include "
            f"ZEALT_RUN_ID namespace {run_id!r}."
        )
    assert not (rerun_names & group_results["billing"]), (
        "Rerun of support filter leaked billing-group file_names."
    )
    assert not (rerun_names & group_results["engineering"]), (
        "Rerun of support filter leaked engineering-group file_names."
    )
