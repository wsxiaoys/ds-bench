import os
import shutil

PROJECT_DIR = "/home/user/nested-comments"


def test_wasp_binary_available():
    assert shutil.which("wasp") is not None, "wasp CLI binary not found in PATH."


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_main_wasp_file_exists():
    main_wasp = os.path.join(PROJECT_DIR, "main.wasp")
    assert os.path.isfile(main_wasp), f"Wasp config file {main_wasp} does not exist."


def test_prisma_schema_file_exists():
    schema = os.path.join(PROJECT_DIR, "schema.prisma")
    assert os.path.isfile(schema), f"Prisma schema file {schema} does not exist."


def test_src_directory_exists():
    src_dir = os.path.join(PROJECT_DIR, "src")
    assert os.path.isdir(src_dir), f"Source directory {src_dir} does not exist."
