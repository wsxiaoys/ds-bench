import shutil
import subprocess


def test_prefect_cli_available():
    assert shutil.which("prefect") is not None, "prefect CLI not found in PATH."


def test_prefect_importable():
    result = subprocess.run(
        ["python3", "-c", "import prefect; print(prefect.__version__)"],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"Failed to import prefect: {result.stderr.strip()}"
    )
    assert result.stdout.strip().startswith("3."), (
        f"Expected Prefect 3.x to be installed, got version: {result.stdout.strip()}"
    )


def test_prefect_version_pinned():
    result = subprocess.run(
        ["python3", "-c", "import prefect; print(prefect.__version__)"],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"Failed to import prefect: {result.stderr.strip()}"
    )
    assert result.stdout.strip() == "3.4.25", (
        f"Expected pinned Prefect version 3.4.25, got: {result.stdout.strip()}"
    )
