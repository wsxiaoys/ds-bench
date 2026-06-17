import os
import shutil
import pytest

PROJECT_DIR = "/home/user/project"

def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."
    assert shutil.which("npx") is not None, "npx binary not found in PATH."

def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."

def test_package_json_exists():
    package_json_path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(package_json_path), f"package.json not found in {PROJECT_DIR}"

def test_convex_dir_exists():
    convex_dir = os.path.join(PROJECT_DIR, "convex")
    assert os.path.isdir(convex_dir), f"convex directory not found in {PROJECT_DIR}"

def test_convex_schema_exists():
    schema_path = os.path.join(PROJECT_DIR, "convex", "schema.ts")
    assert os.path.isfile(schema_path), f"schema.ts not found in {PROJECT_DIR}/convex"

def test_convex_tasks_exists():
    tasks_path = os.path.join(PROJECT_DIR, "convex", "tasks.ts")
    assert os.path.isfile(tasks_path), f"tasks.ts not found in {PROJECT_DIR}/convex"

def test_initial_mutation_has_fetch():
    tasks_path = os.path.join(PROJECT_DIR, "convex", "tasks.ts")
    with open(tasks_path, "r") as f:
        content = f.read()
    assert "mutation" in content, "tasks.ts should contain a mutation"
    assert "fetch(" in content, "tasks.ts should contain a fetch call inside the mutation"
