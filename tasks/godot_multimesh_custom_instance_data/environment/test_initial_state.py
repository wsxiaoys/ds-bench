import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/instancing_project"


def test_godot_binary_available():
    assert shutil.which("godot") is not None, "godot binary not found in PATH."


def test_godot_runs_headless():
    godot = shutil.which("godot")
    assert godot is not None, "godot binary not found in PATH."
    result = subprocess.run(
        [godot, "--headless", "--version"],
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert result.returncode == 0, (
        f"`godot --headless --version` failed with code {result.returncode}: "
        f"{result.stdout}\n{result.stderr}"
    )
    assert result.stdout.strip().startswith("4."), (
        f"Expected a Godot 4.x version, got: {result.stdout.strip()!r}"
    )


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_project_godot_exists():
    project_file = os.path.join(PROJECT_DIR, "project.godot")
    assert os.path.isfile(project_file), (
        f"Godot project manifest {project_file} does not exist."
    )


def test_solution_not_present_yet():
    # The agent is expected to CREATE the class script; it must not pre-exist.
    script_path = os.path.join(PROJECT_DIR, "instancing", "instance_field.gd")
    assert not os.path.isfile(script_path), (
        f"{script_path} should not exist before the task is solved."
    )
