import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/jwt-api"


def test_wasp_cli_available():
    assert shutil.which("wasp") is not None, "wasp CLI not found in PATH."


def test_wasp_cli_runs():
    result = subprocess.run(["wasp", "--version"], capture_output=True, text=True)
    assert result.returncode == 0, f"`wasp --version` failed: {result.stderr}"
    assert "wasp version" in result.stdout.lower(), (
        f"Unexpected `wasp --version` output: {result.stdout}"
    )


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} not found."


def test_main_wasp_exists():
    wasp_file = os.path.join(PROJECT_DIR, "main.wasp")
    assert os.path.isfile(wasp_file), f"main.wasp not found at {wasp_file}."
