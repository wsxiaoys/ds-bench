import os
import json
import subprocess

PROJECT_DIR = "/home/user/myproject"
RESULT_FILE = os.path.join(PROJECT_DIR, "payload_result.json")


def test_payload_helper_runs():
    """Priority 1: Execute the agent's script."""
    result = subprocess.run(
        ["node", "payload_helper.js"], capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"node payload_helper.js must exit 0; stderr={result.stderr.strip()}"


def test_result_file_exists():
    assert os.path.isfile(RESULT_FILE), f"payload_result.json must exist at {RESULT_FILE}"


def test_shape_valid():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    assert data.get("shapeValid") is True, (
        f"shapeValid must be true; got: {data.get('shapeValid')}"
    )


def test_post_count_is_two():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    assert data.get("postCount") == 2, (
        f"postCount must be 2; got: {data.get('postCount')}"
    )


def test_db_has_two_posts_for_user():
    """Priority 1: Confirm via live DB query."""
    result = subprocess.run(
        ["node", "-e",
         "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); "
         "p.post.count({ where: { author: { email: 'shape@example.com' } } })"
         ".then(n => { console.log(n); p.$disconnect(); })"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"stderr={result.stderr.strip()}"
    assert result.stdout.strip() == "2", (
        f"DB must have 2 posts for shape@example.com; found {result.stdout.strip()}"
    )
