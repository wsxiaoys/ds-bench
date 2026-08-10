import os
import shutil
import subprocess

import pytest

PROJECT_DIR = "/home/user/godot_coroutine_scheduler"


def test_godot_binary_available():
    assert shutil.which("godot") is not None, "godot binary not found in PATH."


def test_godot_is_version_4_3():
    result = subprocess.run(
        ["godot", "--headless", "--version"],
        capture_output=True,
        text=True,
        timeout=60,
    )
    combined = (result.stdout or "") + (result.stderr or "")
    assert "4.3" in combined, (
        f"Expected Godot 4.3, got version output: {combined!r}"
    )


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )


def test_project_godot_file_exists():
    project_file = os.path.join(PROJECT_DIR, "project.godot")
    assert os.path.isfile(project_file), (
        f"Godot project manifest {project_file} does not exist."
    )
