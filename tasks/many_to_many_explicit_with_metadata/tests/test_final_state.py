import os
import json
import subprocess

PROJECT_DIR = "/home/user/myproject"
SCHEMA_PATH = os.path.join(PROJECT_DIR, "prisma", "schema.prisma")
MIGRATIONS_DIR = os.path.join(PROJECT_DIR, "prisma", "migrations")
RESULT_FILE = os.path.join(PROJECT_DIR, "explicit_m2m_result.json")


def test_schema_has_project_model():
    with open(SCHEMA_PATH) as f:
        content = f.read()
    assert "model Project" in content, "schema.prisma must have Project model"


def test_schema_has_user_project_model():
    with open(SCHEMA_PATH) as f:
        content = f.read()
    assert "model UserProject" in content, "schema.prisma must have UserProject join model"
    assert "role" in content, "UserProject must have a role field"


def test_migration_exists():
    dirs = [d for d in os.listdir(MIGRATIONS_DIR)
            if os.path.isdir(os.path.join(MIGRATIONS_DIR, d))]
    assert any("add_project_m2m" in d for d in dirs), (
        f"Migration 'add_project_m2m' must exist; found: {dirs}"
    )


def test_explicit_m2m_script_runs():
    """Priority 1: Execute the agent's script."""
    result = subprocess.run(
        ["node", "explicit_m2m.js"], capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"node explicit_m2m.js must exit 0; stderr={result.stderr.strip()}"


def test_result_file_exists():
    assert os.path.isfile(RESULT_FILE), f"explicit_m2m_result.json must exist at {RESULT_FILE}"


def test_result_email():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    assert data.get("email") == "pm@example.com", (
        f"Result email must be 'pm@example.com'; got: {data.get('email')}"
    )


def test_result_user_project_role():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    up = data.get("userProjects", [])
    assert len(up) >= 1, "userProjects must have at least one entry"
    assert up[0].get("role") == "admin", (
        f"UserProject role must be 'admin'; got: {up[0].get('role')}"
    )


def test_result_project_name():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    up = data.get("userProjects", [])
    project = up[0].get("project", {}) if up else {}
    assert project.get("name") == "Alpha", (
        f"Project name must be 'Alpha'; got: {project.get('name')}"
    )
