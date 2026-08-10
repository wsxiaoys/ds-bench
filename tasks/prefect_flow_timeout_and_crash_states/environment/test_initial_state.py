# pyright: reportMissingImports=false
import shutil

import pytest


def test_prefect_cli_available():
    assert shutil.which("prefect") is not None, "prefect CLI not found in PATH."


def test_prefect_importable():
    try:
        import prefect  # noqa: F401
    except Exception as exc:  # pragma: no cover - defensive
        pytest.fail(f"Failed to import the prefect library: {exc}")


def test_prefect_flow_symbol_available():
    from prefect import flow  # noqa: F401

    assert callable(flow), "prefect.flow is not callable."


def test_run_id_artifact_present():
    run_id_path = "/logs/artifacts/run-id"
    with open(run_id_path) as f:
        run_id = f.read().strip()
    assert run_id, f"run-id artifact {run_id_path} is empty."
