import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/myproject"
SCHEMA_PATH = os.path.join(PROJECT_DIR, "prisma", "schema.prisma")


def test_node_available():
    assert shutil.which("node") is not None, "node must be available in PATH"


def test_npx_available():
    assert shutil.which("npx") is not None, "npx must be available in PATH"


def test_prisma_cli_available():
    result = subprocess.run(
        ["npx", "prisma", "--version"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, (
        f"npx prisma --version must exit 0; stderr={result.stderr.strip()}"
    )


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory must exist at {PROJECT_DIR}"


def test_schema_prisma_exists():
    assert os.path.isfile(SCHEMA_PATH), f"schema.prisma must exist at {SCHEMA_PATH}"


def test_schema_has_sqlite_datasource():
    with open(SCHEMA_PATH) as f:
        content = f.read()
    assert 'provider = "sqlite"' in content, (
        "schema.prisma must already have SQLite datasource configured"
    )


def test_schema_has_user_model():
    with open(SCHEMA_PATH) as f:
        content = f.read()
    assert "model User" in content, (
        "schema.prisma must already contain a User model before the task begins"
    )


def test_schema_has_no_post_model():
    with open(SCHEMA_PATH) as f:
        content = f.read()
    assert "model Post" not in content, (
        "schema.prisma must NOT contain a Post model yet — the agent is expected to add it"
    )


def test_prisma_client_does_not_expose_post():
    result = subprocess.run(
        ["node", "-e",
         "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); console.log(typeof p.post);"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    # It's OK if this fails (client not generated yet) or prints "undefined"
    if result.returncode == 0:
        assert "undefined" in result.stdout, (
            "Before the task, prisma.post must not exist on the client (should be undefined)"
        )
