import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/myproject"
SCHEMA_PATH = os.path.join(PROJECT_DIR, "prisma", "schema.prisma")
MIGRATIONS_DIR = os.path.join(PROJECT_DIR, "prisma", "migrations")


def test_node_is_available():
    result = shutil.which("node")
    assert result is not None, "node binary must be available in PATH"


def test_npx_is_available():
    result = shutil.which("npx")
    assert result is not None, "npx binary must be available in PATH"


def test_prisma_cli_is_available():
    result = subprocess.run(
        ["npx", "prisma", "--version"],
        capture_output=True,
        text=True,
        cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, (
        f"npx prisma --version must exit 0; got returncode={result.returncode}, "
        f"stderr={result.stderr.strip()}"
    )


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory must exist at {PROJECT_DIR}"
    )


def test_schema_prisma_exists():
    assert os.path.isfile(SCHEMA_PATH), (
        f"prisma/schema.prisma must exist at {SCHEMA_PATH}"
    )


def test_schema_has_sqlite_datasource():
    with open(SCHEMA_PATH, "r") as f:
        content = f.read()
    assert 'provider = "sqlite"' in content, (
        'schema.prisma must contain \'provider = "sqlite"\' in the datasource block'
    )


def test_schema_has_database_url_env():
    with open(SCHEMA_PATH, "r") as f:
        content = f.read()
    assert "DATABASE_URL" in content, (
        "schema.prisma must reference DATABASE_URL environment variable"
    )


def test_schema_has_no_user_model():
    with open(SCHEMA_PATH, "r") as f:
        content = f.read()
    assert "model User" not in content, (
        "schema.prisma must NOT contain a User model in the initial state — "
        "the agent is expected to add it"
    )


def test_migrations_directory_does_not_exist_or_is_empty():
    if not os.path.exists(MIGRATIONS_DIR):
        return  # Does not exist at all — correct initial state
    entries = [
        e for e in os.listdir(MIGRATIONS_DIR)
        if not e.startswith(".")
    ]
    assert len(entries) == 0, (
        f"prisma/migrations directory must be absent or empty before the task runs; "
        f"found: {entries}"
    )


def test_env_file_has_sqlite_database_url():
    env_path = os.path.join(PROJECT_DIR, ".env")
    assert os.path.isfile(env_path), (
        f".env file must exist at {env_path}"
    )
    with open(env_path, "r") as f:
        content = f.read()
    assert "file:./dev.db" in content, (
        '.env must contain DATABASE_URL pointing to "file:./dev.db" for SQLite'
    )
