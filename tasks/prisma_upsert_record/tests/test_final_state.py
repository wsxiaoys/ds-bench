import os
import json
import subprocess

PROJECT_DIR = "/home/user/myproject"
RESULT_FILE = os.path.join(PROJECT_DIR, "upsert_result.json")


def test_upsert_script_runs_successfully():
    """Priority 1: Run the agent's script."""
    result = subprocess.run(
        ["node", "upsert.js"], capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"node upsert.js must exit 0; stderr={result.stderr.strip()}"


def test_result_file_exists():
    assert os.path.isfile(RESULT_FILE), f"upsert_result.json must exist at {RESULT_FILE}"


def test_result_email_correct():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    assert data.get("email") == "upsert@example.com", (
        f"Result must have email='upsert@example.com'; got: {data}"
    )


def test_result_name_is_second_run():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    assert data.get("name") == "Second Run", (
        f"After two upserts, name must be 'Second Run'; got: {data.get('name')}"
    )


def test_only_one_record_in_db():
    """Priority 1: Confirm upsert didn't create duplicates."""
    result = subprocess.run(
        ["node", "-e",
         "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); "
         "p.user.count({ where: { email: 'upsert@example.com' } })"
         ".then(n => { console.log(n); p.$disconnect(); })"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"stderr={result.stderr.strip()}"
    count = int(result.stdout.strip())
    assert count == 1, f"Exactly one record with upsert@example.com must exist; found {count}"
