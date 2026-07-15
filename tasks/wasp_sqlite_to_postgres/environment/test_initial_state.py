import os
import re
import shutil
import socket

import pytest

PROJECT_DIR = "/home/user/taskvault"
MAIN_WASP = os.path.join(PROJECT_DIR, "main.wasp")
SCHEMA_PRISMA = os.path.join(PROJECT_DIR, "schema.prisma")
MIGRATIONS_DIR = os.path.join(PROJECT_DIR, "migrations")
SRC_DIR = os.path.join(PROJECT_DIR, "src")


def test_wasp_binary_available():
    assert shutil.which("wasp") is not None, "The 'wasp' CLI binary was not found in PATH."


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_main_wasp_exists():
    assert os.path.isfile(MAIN_WASP), f"Wasp declaration file {MAIN_WASP} does not exist."


def test_src_directory_exists():
    assert os.path.isdir(SRC_DIR), f"Source directory {SRC_DIR} does not exist."


def test_schema_prisma_exists():
    assert os.path.isfile(SCHEMA_PRISMA), f"Prisma schema file {SCHEMA_PRISMA} does not exist."


def test_initial_database_provider_is_sqlite():
    with open(SCHEMA_PRISMA) as f:
        content = f.read()
    assert re.search(r'provider\s*=\s*"sqlite"', content), (
        "Expected the initial schema.prisma datasource provider to be \"sqlite\"."
    )


def test_task_model_present():
    with open(SCHEMA_PRISMA) as f:
        content = f.read()
    assert re.search(r"model\s+Task\s*\{", content), (
        "Expected a 'Task' model to be defined in schema.prisma."
    )


def test_migrations_directory_exists():
    assert os.path.isdir(MIGRATIONS_DIR), (
        f"Migrations directory {MIGRATIONS_DIR} (with the existing SQLite migrations) does not exist."
    )


def test_migration_lock_is_initially_sqlite():
    lock_path = os.path.join(MIGRATIONS_DIR, "migration_lock.toml")
    assert os.path.isfile(lock_path), f"Expected {lock_path} to exist for the initial SQLite migrations."
    with open(lock_path) as f:
        content = f.read()
    assert re.search(r'provider\s*=\s*"sqlite"', content), (
        "Expected the initial migrations/migration_lock.toml to report the \"sqlite\" provider."
    )


def test_operations_declared_in_main_wasp():
    with open(MAIN_WASP) as f:
        content = f.read()
    assert "getTasks" in content, "Expected the 'getTasks' query to be declared in main.wasp."
    assert "createTask" in content, "Expected the 'createTask' action to be declared in main.wasp."


def test_stats_api_declared_in_main_wasp():
    with open(MAIN_WASP) as f:
        content = f.read()
    assert "/api/stats" in content, "Expected the custom 'GET /api/stats' API route to be declared in main.wasp."


def test_local_postgres_is_running():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(5)
        try:
            sock.connect(("127.0.0.1", 5432))
        except OSError as exc:  # pragma: no cover - environment failure path
            pytest.fail(f"Local PostgreSQL server is not reachable on 127.0.0.1:5432: {exc}")
