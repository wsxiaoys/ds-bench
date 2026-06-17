import os
import json
import subprocess

PROJECT_DIR = "/home/user/myproject"
RESULT_FILE = os.path.join(PROJECT_DIR, "rls_result.json")


def test_rls_script_runs():
    """Priority 1: Execute the agent's script."""
    result = subprocess.run(
        ["node", "rls.js"], capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"node rls.js must exit 0; stderr={result.stderr.strip()}"


def test_result_file_exists():
    assert os.path.isfile(RESULT_FILE), f"rls_result.json must exist at {RESULT_FILE}"


def test_acme_count():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    assert data.get("acmeCount") == 2, (
        f"acmeCount must be 2; got: {data.get('acmeCount')}"
    )


def test_globex_count():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    assert data.get("globexCount") == 1, (
        f"globexCount must be 1; got: {data.get('globexCount')}"
    )


def test_total_notes_in_db():
    """Priority 1: Verify total note count via live DB query."""
    result = subprocess.run(
        ["node", "-e",
         "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); "
         "p.note.count().then(n => { console.log(n); p.$disconnect(); })"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"stderr={result.stderr.strip()}"
    assert result.stdout.strip() == "3", (
        f"Total notes in DB must be 3; found {result.stdout.strip()}"
    )
