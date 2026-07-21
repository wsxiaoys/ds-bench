import os
import shutil

PROJECT_DIR = "/home/user/blog"


def test_wasp_binary_available():
    assert shutil.which("wasp") is not None, "The `wasp` CLI was not found in PATH."


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_wasp_config_file_present():
    wasp_file = os.path.join(PROJECT_DIR, "main.wasp")
    assert os.path.isfile(wasp_file), f"Scaffolded Wasp file {wasp_file} does not exist."


def test_prisma_schema_present():
    schema_file = os.path.join(PROJECT_DIR, "schema.prisma")
    assert os.path.isfile(schema_file), f"Scaffolded Prisma schema {schema_file} does not exist."


def test_database_url_env_is_set():
    database_url = os.environ.get("DATABASE_URL", "")
    assert database_url.strip() != "", "DATABASE_URL environment variable is not set."
    assert database_url.startswith("postgres"), (
        "DATABASE_URL must point to a PostgreSQL database (expected a 'postgres'/'postgresql' scheme)."
    )
