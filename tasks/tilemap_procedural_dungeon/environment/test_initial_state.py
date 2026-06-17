import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/myproject"


def test_godot_binary_available():
    assert shutil.which("godot") is not None, "godot binary not found in PATH."


def test_godot_runs_headless():
    result = subprocess.run(
        ["godot", "--headless", "--version"],
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 0, (
        f"`godot --headless --version` failed with exit code {result.returncode}. "
        f"stderr: {result.stderr}"
    )
    assert result.stdout.strip().startswith("4."), (
        f"Expected Godot 4.x but got version output: {result.stdout!r}"
    )


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )
