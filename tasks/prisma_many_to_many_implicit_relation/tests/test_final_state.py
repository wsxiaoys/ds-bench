import os
import json
import subprocess

PROJECT_DIR = "/home/user/myproject"
SCHEMA_PATH = os.path.join(PROJECT_DIR, "prisma", "schema.prisma")
MIGRATIONS_DIR = os.path.join(PROJECT_DIR, "prisma", "migrations")
RESULT_FILE = os.path.join(PROJECT_DIR, "m2m_result.json")


def test_schema_has_tag_model():
    with open(SCHEMA_PATH) as f:
        content = f.read()
    assert "model Tag" in content, "schema.prisma must contain 'model Tag'"


def test_tag_model_has_posts_relation():
    with open(SCHEMA_PATH) as f:
        content = f.read()
    assert "posts Post[]" in content, "Tag model must have 'posts Post[]' relation"


def test_post_model_has_tags_relation():
    with open(SCHEMA_PATH) as f:
        content = f.read()
    assert "tags Tag[]" in content, "Post model must have 'tags Tag[]' relation"


def test_add_tags_migration_exists():
    dirs = [d for d in os.listdir(MIGRATIONS_DIR)
            if os.path.isdir(os.path.join(MIGRATIONS_DIR, d))]
    assert any("add_tags" in d for d in dirs), (
        f"A migration containing 'add_tags' must exist; found: {dirs}"
    )


def test_m2m_script_runs():
    """Priority 1: Execute the agent's script."""
    result = subprocess.run(
        ["node", "m2m.js"], capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"node m2m.js must exit 0; stderr={result.stderr.strip()}"


def test_result_file_exists():
    assert os.path.isfile(RESULT_FILE), f"m2m_result.json must exist at {RESULT_FILE}"


def test_result_post_title():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    assert data.get("title") == "Prisma Node", (
        f"Result post title must be 'Prisma Node'; got: {data.get('title')}"
    )


def test_result_has_two_tags():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    tags = data.get("tags", [])
    assert len(tags) == 2, f"Post must have 2 tags; got {len(tags)}: {tags}"


def test_result_tag_names():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    tag_names = {t["name"] for t in data.get("tags", [])}
    assert tag_names == {"nodejs", "prisma"}, (
        f"Tag names must be {{'nodejs', 'prisma'}}; got: {tag_names}"
    )
