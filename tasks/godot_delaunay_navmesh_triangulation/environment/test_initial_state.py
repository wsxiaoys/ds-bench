import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/project"


def test_godot_binary_available():
    assert shutil.which("godot") is not None, "godot binary not found in PATH."


def test_godot_headless_runs():
    result = subprocess.run(
        ["godot", "--headless", "--version"],
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert result.returncode == 0, (
        f"`godot --headless --version` failed (exit {result.returncode}). "
        f"stdout={result.stdout!r} stderr={result.stderr!r}"
    )
    assert "4." in result.stdout, (
        f"Expected a Godot 4.x version string, got: {result.stdout!r}"
    )


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_project_godot_file_exists():
    project_file = os.path.join(PROJECT_DIR, "project.godot")
    assert os.path.isfile(project_file), (
        f"Godot project manifest {project_file} does not exist."
    )
