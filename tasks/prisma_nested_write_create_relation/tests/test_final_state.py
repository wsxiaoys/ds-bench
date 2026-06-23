import os
import json
import subprocess

PROJECT_DIR = "/home/user/myproject"
RESULT_FILE = os.path.join(PROJECT_DIR, "nested_result.json")


def test_nested_script_runs():
    """Priority 1: Run the agent's script."""
    result = subprocess.run(
        ["node", "nested.js"], capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"node nested.js must exit 0; stderr={result.stderr.strip()}"


def test_result_file_exists():
    assert os.path.isfile(RESULT_FILE), f"nested_result.json must exist at {RESULT_FILE}"


def test_result_email():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    assert data.get("email") == "nested@example.com", (
        f"Result email must be 'nested@example.com'; got: {data.get('email')}"
    )


def test_result_has_two_posts():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    posts = data.get("posts", [])
    assert len(posts) == 2, f"Result must have 2 nested posts; got {len(posts)}"


def test_result_post_titles():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    titles = {p["title"] for p in data.get("posts", [])}
    assert titles == {"Nested Post A", "Nested Post B"}, (
        f"Post titles must be 'Nested Post A' and 'Nested Post B'; got: {titles}"
    )


def test_db_has_two_posts_for_nested_user():
    """Priority 1: Confirm via live DB query."""
    result = subprocess.run(
        ["node", "-e",
         "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); "
         "p.post.count({ where: { author: { email: 'nested@example.com' } } })"
         ".then(n => { console.log(n); p.$disconnect(); })"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"stderr={result.stderr.strip()}"
    assert result.stdout.strip() == "2", (
        f"DB must have 2 posts for nested@example.com; got: {result.stdout.strip()}"
    )
