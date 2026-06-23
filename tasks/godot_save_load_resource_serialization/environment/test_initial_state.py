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
        f"`godot --headless --version` failed with code {result.returncode}: "
        f"stdout={result.stdout!r} stderr={result.stderr!r}"
    )
    assert result.stdout.strip().startswith("4."), (
        f"Expected Godot 4.x, got version output: {result.stdout!r}"
    )


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_project_godot_file_exists():
    project_file = os.path.join(PROJECT_DIR, "project.godot")
    assert os.path.isfile(project_file), (
        f"Godot project manifest {project_file} does not exist."
    )


def test_scripts_dir_absent_or_empty():
    # The executor is expected to create scripts/ItemData.gd, GameSaveData.gd, SaveManager.gd.
    # The initial state must not already contain these files.
    for fname in ("ItemData.gd", "GameSaveData.gd", "SaveManager.gd"):
        path = os.path.join(PROJECT_DIR, "scripts", fname)
        assert not os.path.exists(path), (
            f"Initial scaffold must not contain {path}; the executor is expected to create it."
        )
