import os
import shutil
import subprocess

HOME_DIR = "/home/user"


def test_godot_binary_available():
    assert shutil.which("godot") is not None, "godot binary not found in PATH."


def test_godot_is_version_4_3():
    result = subprocess.run(
        ["godot", "--version"],
        capture_output=True,
        text=True,
        timeout=60,
    )
    combined = (result.stdout + result.stderr).strip()
    assert "4.3" in combined, (
        f"Expected Godot 4.3, but `godot --version` reported: {combined!r}"
    )


def test_godot_headless_runs():
    # A headless engine invocation with --quit should start and exit cleanly.
    result = subprocess.run(
        ["godot", "--headless", "--quit"],
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert result.returncode == 0, (
        "godot --headless --quit did not exit cleanly; "
        f"return code {result.returncode}, stderr: {result.stderr!r}"
    )


def test_home_directory_exists():
    assert os.path.isdir(HOME_DIR), f"Home directory {HOME_DIR} does not exist."
