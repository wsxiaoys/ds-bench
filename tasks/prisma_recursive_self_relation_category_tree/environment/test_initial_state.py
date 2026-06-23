import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/myproject"
SCHEMA_PATH = os.path.join(PROJECT_DIR, "prisma", "schema.prisma")


def test_node_available():
    assert shutil.which("node") is not None, "node must be in PATH"


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project dir must exist at {PROJECT_DIR}"


def test_schema_has_no_category_model():
    with open(SCHEMA_PATH) as f:
        content = f.read()
    assert "model Category" not in content, "schema.prisma must NOT have Category model yet"


def test_npx_prisma_available():
    result = subprocess.run(
        ["npx", "prisma", "--version"], capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"npx prisma must work; stderr={result.stderr.strip()}"


def test_tree_script_does_not_exist():
    assert not os.path.isfile(os.path.join(PROJECT_DIR, "tree.js")), "tree.js must not exist yet"
