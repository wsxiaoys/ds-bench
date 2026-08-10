import os
import shutil
import pytest

PROJECT_DIR = "/home/user/app"

def test_wasp_cli_available():
    """Verify that Wasp CLI is installed and available in PATH."""
    assert shutil.which("wasp") is not None, "wasp CLI is not available in PATH."

def test_node_and_npm_available():
    """Verify that Node.js and npm are available in PATH."""
    assert shutil.which("node") is not None, "Node.js is not available in PATH."
    assert shutil.which("npm") is not None, "npm is not available in PATH."

def test_project_directory_exists():
    """Verify that the Wasp project directory exists."""
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."

def test_initial_files_exist():
    """Verify that key initial Wasp files exist inside the project directory."""
    main_wasp_ts = os.path.join(PROJECT_DIR, "main.wasp.ts")
    schema_prisma = os.path.join(PROJECT_DIR, "schema.prisma")
    package_json = os.path.join(PROJECT_DIR, "package.json")

    assert os.path.isfile(main_wasp_ts), f"Wasp spec file {main_wasp_ts} is missing."
    assert os.path.isfile(schema_prisma), f"Prisma schema file {schema_prisma} is missing."
    assert os.path.isfile(package_json), f"package.json file {package_json} is missing."
