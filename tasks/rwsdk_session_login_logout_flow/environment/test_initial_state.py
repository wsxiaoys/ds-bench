import json
import os
import shutil

PROJECT_DIR = "/home/user/project"


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_package_json_exists():
    package_json = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(package_json), f"{package_json} does not exist."


def test_rwsdk_dependency_present():
    package_json = os.path.join(PROJECT_DIR, "package.json")
    with open(package_json) as f:
        data = json.load(f)
    deps = {}
    deps.update(data.get("dependencies", {}) or {})
    deps.update(data.get("devDependencies", {}) or {})
    assert "rwsdk" in deps, "Expected 'rwsdk' to be a dependency of the project."


def test_wrangler_config_exists():
    wrangler = os.path.join(PROJECT_DIR, "wrangler.jsonc")
    assert os.path.isfile(wrangler), f"{wrangler} does not exist."


def test_users_seed_file_exists():
    users_path = os.path.join(PROJECT_DIR, "users.json")
    assert os.path.isfile(users_path), f"Seed file {users_path} does not exist."


def test_users_seed_file_has_expected_users():
    users_path = os.path.join(PROJECT_DIR, "users.json")
    with open(users_path) as f:
        users = json.load(f)
    assert isinstance(users, list) and len(users) >= 2, \
        "users.json should be a list of at least two users."
    for user in users:
        for field in ("id", "username", "password"):
            assert field in user, f"Each user in users.json must include '{field}'."
    usernames = {u["username"] for u in users}
    assert {"alice", "bob"}.issubset(usernames), \
        "users.json must contain seed users 'alice' and 'bob'."
