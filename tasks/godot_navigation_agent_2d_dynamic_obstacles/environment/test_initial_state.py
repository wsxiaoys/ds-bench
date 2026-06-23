import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/godot_project"


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
        f"stdout={result.stdout!r} stderr={result.stderr!r}"
    )
    assert result.stdout.strip().startswith("4."), (
        f"Expected Godot major version 4.x, got: {result.stdout!r}"
    )


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )


def test_project_godot_file_exists():
    path = os.path.join(PROJECT_DIR, "project.godot")
    assert os.path.isfile(path), (
        f"Godot project manifest {path} does not exist."
    )


def test_scripts_dir_exists():
    path = os.path.join(PROJECT_DIR, "scripts")
    assert os.path.isdir(path), (
        f"Scripts directory {path} does not exist."
    )


def test_scenes_dir_exists():
    path = os.path.join(PROJECT_DIR, "scenes")
    assert os.path.isdir(path), (
        f"Scenes directory {path} does not exist."
    )


def test_tests_dir_exists():
    path = os.path.join(PROJECT_DIR, "tests")
    assert os.path.isdir(path), (
        f"Tests directory {path} does not exist."
    )


def test_test_runner_present():
    path = os.path.join(PROJECT_DIR, "tests", "run_tests.gd")
    assert os.path.isfile(path), (
        f"Verifier test harness {path} does not exist."
    )
