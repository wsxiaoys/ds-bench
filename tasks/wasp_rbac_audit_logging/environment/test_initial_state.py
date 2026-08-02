import os
import shutil
import pytest

PROJECT_DIR = "/home/user/app"

def test_wasp_binary_available():
    assert shutil.which("wasp") is not None, "wasp binary not found in PATH."

def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."

def test_initial_wasp_files_exist():
    # In initial state, the app should be a seeded minimal Wasp project
    # containing main.wasp.ts, schema.prisma, and package.json.
    assert os.path.isfile(os.path.join(PROJECT_DIR, "package.json")), "package.json not found in project directory."
