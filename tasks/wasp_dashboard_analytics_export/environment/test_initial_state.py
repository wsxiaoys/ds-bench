import os
import shutil
import pytest

PROJECT_DIR = "/home/user/app"

def test_wasp_binary_available():
    assert shutil.which("wasp") is not None, "wasp binary not found in PATH."

def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."

def test_initial_project_structure():
    main_wasp = os.path.join(PROJECT_DIR, "main.wasp.ts")
    schema_prisma = os.path.join(PROJECT_DIR, "schema.prisma")
    package_json = os.path.join(PROJECT_DIR, "package.json")

    assert os.path.isfile(main_wasp), f"Wasp configuration file {main_wasp} does not exist."
    assert os.path.isfile(schema_prisma), f"Prisma schema file {schema_prisma} does not exist."
    assert os.path.isfile(package_json), f"package.json {package_json} does not exist."
