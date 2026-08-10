import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/ecs_project"


def test_godot_binary_available():
    assert shutil.which("godot") is not None, "The 'godot' binary was not found in PATH."


def test_godot_version_is_4():
    result = subprocess.run(
        ["godot", "--version"],
        capture_output=True,
        text=True,
        timeout=60,
    )
    combined = (result.stdout or "") + (result.stderr or "")
    assert "4." in combined, (
        f"Expected a Godot 4.x engine; 'godot --version' returned: {combined.strip()!r}"
    )


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"The Godot project directory {PROJECT_DIR} does not exist."
    )


def test_project_godot_exists():
    project_file = os.path.join(PROJECT_DIR, "project.godot")
    assert os.path.isfile(project_file), (
        f"The Godot project manifest {project_file} does not exist."
    )
