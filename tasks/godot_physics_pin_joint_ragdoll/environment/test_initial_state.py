import os
import shutil
import subprocess


PROJECT_DIR = "/home/user/ragdoll"


def test_godot_binary_available():
    assert shutil.which("godot") is not None, (
        "godot binary not found in PATH; expected a headless Godot 4 binary."
    )


def test_godot_is_version_4():
    result = subprocess.run(
        ["godot", "--headless", "--version"],
        capture_output=True,
        text=True,
        timeout=60,
    )
    combined = (result.stdout or "") + (result.stderr or "")
    assert result.returncode == 0, (
        f"`godot --headless --version` failed with exit code {result.returncode}: {combined}"
    )
    assert combined.strip().startswith("4."), (
        f"Expected Godot 4.x, got version output: {combined.strip()!r}"
    )


def test_home_user_exists():
    assert os.path.isdir("/home/user"), (
        "Expected /home/user to exist as the executor home directory."
    )


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Expected project directory {PROJECT_DIR} to exist as the workspace."
    )


def test_project_godot_exists():
    project_file = os.path.join(PROJECT_DIR, "project.godot")
    assert os.path.isfile(project_file), (
        f"Expected an initial Godot 4 project file at {project_file}."
    )
