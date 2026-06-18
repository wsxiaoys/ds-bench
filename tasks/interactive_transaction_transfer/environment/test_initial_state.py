import os
import shutil
import subprocess
import json

PROJECT_DIR = "/home/user/myproject"
SCHEMA_PATH = os.path.join(PROJECT_DIR, "prisma", "schema.prisma")


def test_node_available():
    assert shutil.which("node") is not None, "node must be in PATH"


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project dir must exist at {PROJECT_DIR}"


def test_schema_has_account_model():
    with open(SCHEMA_PATH) as f:
        content = f.read()
    assert "model Account" in content, "schema.prisma must have Account model"
    assert "balance" in content, "Account must have balance field"
    assert "owner" in content, "Account must have owner field"


def test_alice_has_balance_100():
    result = subprocess.run(
        ["node", "-e",
         "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); "
         "p.account.findUnique({ where: { owner: 'alice' } })"
         ".then(a => { console.log(a.balance); p.$disconnect(); })"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"stderr={result.stderr.strip()}"
    assert float(result.stdout.strip()) == 100.0, (
        f"Alice must start with balance 100; found {result.stdout.strip()}"
    )


def test_bob_has_balance_50():
    result = subprocess.run(
        ["node", "-e",
         "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); "
         "p.account.findUnique({ where: { owner: 'bob' } })"
         ".then(a => { console.log(a.balance); p.$disconnect(); })"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"stderr={result.stderr.strip()}"
    assert float(result.stdout.strip()) == 50.0, (
        f"Bob must start with balance 50; found {result.stdout.strip()}"
    )


def test_transfer_script_does_not_exist():
    assert not os.path.isfile(os.path.join(PROJECT_DIR, "transfer.js")), \
        "transfer.js must not exist yet"
