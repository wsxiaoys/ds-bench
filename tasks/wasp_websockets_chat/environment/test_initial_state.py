import os
import shutil

PROJECT_DIR = "/home/user/chatapp"


def test_wasp_binary_available():
    assert shutil.which("wasp") is not None, "wasp binary not found in PATH."


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_main_wasp_exists():
    main_wasp = os.path.join(PROJECT_DIR, "main.wasp")
    assert os.path.isfile(main_wasp), f"Scaffolded Wasp config {main_wasp} does not exist."


def test_schema_prisma_exists():
    schema_prisma = os.path.join(PROJECT_DIR, "schema.prisma")
    assert os.path.isfile(schema_prisma), f"Prisma schema {schema_prisma} does not exist."


def test_database_is_local_sqlite():
    schema_prisma = os.path.join(PROJECT_DIR, "schema.prisma")
    with open(schema_prisma) as f:
        content = f.read()
    assert "sqlite" in content, "Expected the scaffolded project to use a local SQLite datasource."
