import os
import json
import subprocess

PROJECT_DIR = "/home/user/myproject"
SCHEMA_PATH = os.path.join(PROJECT_DIR, "prisma", "schema.prisma")
MIGRATIONS_DIR = os.path.join(PROJECT_DIR, "prisma", "migrations")
RESULT_FILE = os.path.join(PROJECT_DIR, "tree_result.json")


def test_schema_has_category_model():
    with open(SCHEMA_PATH) as f:
        content = f.read()
    assert "model Category" in content, "schema.prisma must have Category model"


def test_schema_category_has_self_relation():
    with open(SCHEMA_PATH) as f:
        content = f.read()
    assert "parentId" in content, "Category must have parentId field"
    assert "children" in content, "Category must have children relation"


def test_add_category_migration_exists():
    dirs = [d for d in os.listdir(MIGRATIONS_DIR)
            if os.path.isdir(os.path.join(MIGRATIONS_DIR, d))]
    assert any("add_category" in d or "category" in d.lower() for d in dirs), (
        f"A migration for 'add_category' must exist; found: {dirs}"
    )


def test_tree_script_runs():
    """Priority 1: Execute the agent's script."""
    result = subprocess.run(
        ["node", "tree.js"], capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"node tree.js must exit 0; stderr={result.stderr.strip()}"


def test_result_file_exists():
    assert os.path.isfile(RESULT_FILE), f"tree_result.json must exist at {RESULT_FILE}"


def test_root_name():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    assert data.get("name") == "Electronics", (
        f"Root category must be 'Electronics'; got: {data.get('name')}"
    )


def test_child_name():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    children = data.get("children", [])
    assert len(children) >= 1, "Root must have at least one child"
    assert children[0].get("name") == "Phones", (
        f"Child must be 'Phones'; got: {children[0].get('name')}"
    )


def test_grandchild_name():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    grandchildren = data.get("children", [{}])[0].get("children", [])
    assert len(grandchildren) >= 1, "Child must have at least one grandchild"
    assert grandchildren[0].get("name") == "Smartphones", (
        f"Grandchild must be 'Smartphones'; got: {grandchildren[0].get('name')}"
    )
