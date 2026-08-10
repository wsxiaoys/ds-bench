import os
import shutil
import pytest

PROJECT_DIR = "/home/user/app"

def test_wasp_binary_available():
    """Verify that wasp-cli binary is available in PATH."""
    assert shutil.which("wasp") is not None, "wasp binary not found in PATH."

def test_project_directory_exists():
    """Verify that the project directory /home/user/app exists."""
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."

def test_initial_wasp_files_exist():
    """Verify that the initial Wasp project files exist in the project directory."""
    main_wasp_ts = os.path.join(PROJECT_DIR, "main.wasp.ts")
    schema_prisma = os.path.join(PROJECT_DIR, "schema.prisma")
    package_json = os.path.join(PROJECT_DIR, "package.json")

    assert os.path.isfile(main_wasp_ts), f"main.wasp.ts not found at {main_wasp_ts}"
    assert os.path.isfile(schema_prisma), f"schema.prisma not found at {schema_prisma}"
    assert os.path.isfile(package_json), f"package.json not found at {package_json}"
