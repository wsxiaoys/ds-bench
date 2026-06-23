import os
import json
import subprocess

PROJECT_DIR = "/home/user/myproject"
RESULT_FILE = os.path.join(PROJECT_DIR, "optimistic_result.json")


def test_optimistic_script_runs():
    """Priority 1: Execute the agent's script."""
    result = subprocess.run(
        ["node", "optimistic.js"], capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"node optimistic.js must exit 0; stderr={result.stderr.strip()}"


def test_result_file_exists():
    assert os.path.isfile(RESULT_FILE), f"optimistic_result.json must exist at {RESULT_FILE}"


def test_conflict_caught():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    assert data.get("conflictCaught") is True, (
        "conflictCaught must be true — stale version update must have been caught"
    )


def test_final_version_is_two():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    assert data.get("finalVersion") == 2, (
        f"finalVersion must be 2; got: {data.get('finalVersion')}"
    )


def test_final_content_is_updated():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    assert data.get("finalContent") == "Updated", (
        f"finalContent must be 'Updated'; got: {data.get('finalContent')}"
    )


def test_db_document_version_and_content():
    """Priority 1: Verify via live DB query."""
    result = subprocess.run(
        ["node", "-e",
         "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); "
         "p.document.findUnique({ where: { id: 1 } })"
         ".then(d => { console.log(JSON.stringify(d)); p.$disconnect(); })"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"stderr={result.stderr.strip()}"
    doc = json.loads(result.stdout.strip())
    assert doc.get("version") == 2, f"DB document version must be 2; got {doc.get('version')}"
    assert doc.get("content") == "Updated", f"DB document content must be 'Updated'; got {doc.get('content')}"
