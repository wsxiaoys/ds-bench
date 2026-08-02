import os
import shutil
import pytest

PROJECT_DIR = "/home/user/app"

def test_wasp_binary_available():
    """Verify that the Wasp CLI is installed and available in PATH."""
    assert shutil.which("wasp") is not None, "Wasp binary not found in PATH."

def test_project_dir_exists():
    """Verify that the project directory exists."""
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."

def test_wasp_spec_file_exists():
    """Verify that the Wasp spec file (main.wasp.ts) exists in the project root."""
    spec_path = os.path.join(PROJECT_DIR, "main.wasp.ts")
    assert os.path.isfile(spec_path), f"Wasp spec file {spec_path} does not exist."

def test_schema_prisma_exists():
    """Verify that the schema.prisma file exists in the project root."""
    prisma_path = os.path.join(PROJECT_DIR, "schema.prisma")
    assert os.path.isfile(prisma_path), f"Prisma schema file {prisma_path} does not exist."

def test_package_json_exists():
    """Verify that package.json exists in the project root."""
    package_json_path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(package_json_path), f"package.json {package_json_path} does not exist."
