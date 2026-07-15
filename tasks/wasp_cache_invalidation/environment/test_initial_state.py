import os
import shutil

PROJECT_DIR = "/home/user/taskboard"


def test_wasp_binary_available():
    assert shutil.which("wasp") is not None, "The 'wasp' CLI was not found in PATH."


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_main_wasp_exists():
    main_wasp = os.path.join(PROJECT_DIR, "main.wasp")
    assert os.path.isfile(main_wasp), f"Expected Wasp config file {main_wasp} to exist in the skeleton."


def test_prisma_schema_exists():
    schema = os.path.join(PROJECT_DIR, "schema.prisma")
    assert os.path.isfile(schema), f"Expected Prisma schema {schema} to exist in the skeleton."


def test_src_directory_exists():
    src_dir = os.path.join(PROJECT_DIR, "src")
    assert os.path.isdir(src_dir), f"Expected source directory {src_dir} to exist in the skeleton."
