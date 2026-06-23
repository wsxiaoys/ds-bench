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
        timeout=30,
    )
    assert result.returncode == 0, (
        f"`godot --headless --version` failed with exit code {result.returncode}. "
        f"stdout: {result.stdout!r} stderr: {result.stderr!r}"
    )
    assert result.stdout.strip().startswith("4."), (
        f"Expected Godot 4.x, got version output: {result.stdout!r}"
    )


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )


def test_project_godot_exists():
    project_file = os.path.join(PROJECT_DIR, "project.godot")
    assert os.path.isfile(project_file), (
        f"Expected starter file {project_file} to exist in the initial state."
    )


def test_project_godot_is_godot4_format():
    project_file = os.path.join(PROJECT_DIR, "project.godot")
    with open(project_file, "r", encoding="utf-8") as f:
        content = f.read()
    assert "config_version=5" in content, (
        "Expected `config_version=5` in project.godot (Godot 4 project format)."
    )
