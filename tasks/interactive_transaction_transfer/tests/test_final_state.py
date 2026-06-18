import os
import json
import subprocess

PROJECT_DIR = "/home/user/myproject"
RESULT_FILE = os.path.join(PROJECT_DIR, "transfer_result.json")


def test_transfer_script_runs():
    """Priority 1: Execute the agent's script."""
    result = subprocess.run(
        ["node", "transfer.js"], capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"node transfer.js must exit 0; stderr={result.stderr.strip()}"


def test_result_file_exists():
    assert os.path.isfile(RESULT_FILE), f"transfer_result.json must exist at {RESULT_FILE}"


def test_alice_balance_is_50():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    assert abs(data.get("alice", -1) - 50.0) < 0.01, (
        f"Alice's balance must be 50 after transfer; got: {data.get('alice')}"
    )


def test_bob_balance_is_100():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    assert abs(data.get("bob", -1) - 100.0) < 0.01, (
        f"Bob's balance must be 100 after transfer; got: {data.get('bob')}"
    )


def test_db_alice_balance():
    """Priority 1: Confirm via live DB query."""
    result = subprocess.run(
        ["node", "-e",
         "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); "
         "p.account.findUnique({ where: { owner: 'alice' } })"
         ".then(a => { console.log(a.balance); p.$disconnect(); })"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"stderr={result.stderr.strip()}"
    assert abs(float(result.stdout.strip()) - 50.0) < 0.01, (
        f"Alice DB balance must be 50; got: {result.stdout.strip()}"
    )


def test_db_bob_balance():
    """Priority 1: Confirm via live DB query."""
    result = subprocess.run(
        ["node", "-e",
         "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); "
         "p.account.findUnique({ where: { owner: 'bob' } })"
         ".then(a => { console.log(a.balance); p.$disconnect(); })"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"stderr={result.stderr.strip()}"
    assert abs(float(result.stdout.strip()) - 100.0) < 0.01, (
        f"Bob DB balance must be 100; got: {result.stdout.strip()}"
    )
