import shutil
import subprocess

import pytest


def test_prefect_cli_available():
    assert shutil.which("prefect") is not None, "prefect CLI binary not found in PATH."


def test_prefect_importable():
    try:
        import prefect  # noqa: F401  # pyright: ignore[reportMissingImports]
    except Exception as exc:  # pragma: no cover - defensive
        pytest.fail(f"Failed to import the prefect Python package: {exc}")


def test_prefect_version_is_pinned():
    result = subprocess.run(
        ["prefect", "version"],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"`prefect version` failed with code {result.returncode}: {result.stderr}"
    )
    assert "3.4.25" in result.stdout, (
        f"Expected Prefect 3.4.25 to be installed, got: {result.stdout}"
    )
