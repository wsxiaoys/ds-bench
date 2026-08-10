import os
import shutil
import pytest

PROJECT_DIR = "/home/user/app"

def test_wasp_cli_available():
    """Verify that wasp CLI is installed and available in PATH."""
    assert shutil.which("wasp") is not None, "wasp CLI binary not found in PATH."

def test_project_directory_exists():
    """Verify that the project directory /home/user/app exists."""
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."

def test_wasp_config_exists():
    """Verify that the Wasp main.wasp.ts configuration file exists."""
    config_path = os.path.join(PROJECT_DIR, "main.wasp.ts")
    assert os.path.isfile(config_path), f"Wasp configuration file {config_path} does not exist."

def test_prisma_schema_exists():
    """Verify that the Prisma schema file exists."""
    schema_path = os.path.join(PROJECT_DIR, "schema.prisma")
    assert os.path.isfile(schema_path), f"Prisma schema file {schema_path} does not exist."

def test_package_json_exists():
    """Verify that package.json exists in the project directory."""
    pkg_path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(pkg_path), f"package.json file {pkg_path} does not exist."
