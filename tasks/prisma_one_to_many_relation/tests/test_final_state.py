import os
import json
import glob
import subprocess

PROJECT_DIR = "/home/user/myproject"
SCHEMA_PATH = os.path.join(PROJECT_DIR, "prisma", "schema.prisma")
MIGRATIONS_DIR = os.path.join(PROJECT_DIR, "prisma", "migrations")
RESULT_FILE = os.path.join(PROJECT_DIR, "relation_result.json")


def test_schema_has_post_model():
    with open(SCHEMA_PATH) as f:
        content = f.read()
    assert "model Post" in content, "schema.prisma must contain 'model Post'"


def test_schema_post_has_author_relation():
    with open(SCHEMA_PATH) as f:
        content = f.read()
    assert "authorId" in content, "Post model must have authorId field"
    assert "@relation" in content, "Post model must have @relation to User"


def test_add_post_migration_exists():
    dirs = [d for d in os.listdir(MIGRATIONS_DIR)
            if os.path.isdir(os.path.join(MIGRATIONS_DIR, d))]
    assert any("add_post" in d for d in dirs), (
        f"A migration named 'add_post' must exist; found: {dirs}"
    )


def test_relation_script_runs():
    """Priority 1: Run the agent's script."""
    result = subprocess.run(
        ["node", "relation.js"], capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"node relation.js must exit 0; stderr={result.stderr.strip()}"


def test_result_file_exists():
    assert os.path.isfile(RESULT_FILE), f"relation_result.json must exist at {RESULT_FILE}"


def test_result_has_correct_email():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    assert data.get("email") == "author@example.com", (
        f"Result must have email='author@example.com'; got: {data.get('email')}"
    )


def test_result_has_two_posts():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    posts = data.get("posts", [])
    assert len(posts) == 2, f"User must have 2 nested posts; got {len(posts)}: {posts}"


def test_result_post_titles():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    titles = {p["title"] for p in data.get("posts", [])}
    assert titles == {"Post One", "Post Two"}, (
        f"Post titles must be 'Post One' and 'Post Two'; got: {titles}"
    )
