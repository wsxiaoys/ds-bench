import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/myproject"
GODOT_BIN = "/opt/godot/godot"


def test_godot_binary_available():
    assert os.path.isfile(GODOT_BIN), (
        f"Godot binary not found at {GODOT_BIN}; the headless Godot 4 build must be installed."
    )
    assert os.access(GODOT_BIN, os.X_OK), (
        f"Godot binary at {GODOT_BIN} is not executable."
    )


def test_godot_binary_on_path():
    assert shutil.which("godot") is not None, (
        "godot binary is not discoverable on PATH; a symlink or PATH entry is required."
    )


def test_godot_reports_version_4():
    result = subprocess.run(
        [GODOT_BIN, "--headless", "--version"],
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, (
        f"`godot --headless --version` failed: stdout={result.stdout!r} stderr={result.stderr!r}"
    )
    combined = (result.stdout + result.stderr).strip()
    assert combined.startswith("4."), (
        f"Expected Godot 4.x but `--version` reported: {combined!r}"
    )


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist; the scaffold should have created it."
    )


def test_project_godot_exists():
    project_file = os.path.join(PROJECT_DIR, "project.godot")
    assert os.path.isfile(project_file), (
        f"{project_file} does not exist; a Godot 4 project scaffold must be present."
    )


def test_project_godot_is_godot_4_config():
    project_file = os.path.join(PROJECT_DIR, "project.godot")
    with open(project_file, "r", encoding="utf-8") as f:
        content = f.read()
    assert "config_version=5" in content, (
        "Scaffolded project.godot must declare `config_version=5` (Godot 4 project format)."
    )
