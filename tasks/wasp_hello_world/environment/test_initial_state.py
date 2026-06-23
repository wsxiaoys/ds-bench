import os
import shutil
import subprocess
import pytest

PROJECT_DIR = "/home/user/my-app"

def test_wasp_cli_available():
    assert shutil.which("wasp") is not None, "wasp CLI not found in PATH."

def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} not found."

def test_main_wasp_exists():
    wasp_file = os.path.join(PROJECT_DIR, "main.wasp")
    assert os.path.isfile(wasp_file), f"main.wasp not found at {wasp_file}."

def test_initial_main_wasp_content():
    wasp_file = os.path.join(PROJECT_DIR, "main.wasp")
    with open(wasp_file, "r") as f:
        content = f.read()
    assert "app my-app" in content or "app my_app" in content, "main.wasp does not contain the expected app declaration."
