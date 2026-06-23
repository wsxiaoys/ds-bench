import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/myproject"
SCHEMA_PATH = os.path.join(PROJECT_DIR, "prisma", "schema.prisma")
RAWCOUNT_SCRIPT = os.path.join(PROJECT_DIR, "rawcount.js")


def test_node_available():
    assert shutil.which("node") is not None, "node must be in PATH"


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project dir must exist at {PROJECT_DIR}"


def test_schema_has_user_model():
    with open(SCHEMA_PATH) as f:
        content = f.read()
    assert "model User" in content, "schema.prisma must have User model"


def test_rawcount_script_exists():
    assert os.path.isfile(RAWCOUNT_SCRIPT), (
        f"rawcount.js must already exist at {RAWCOUNT_SCRIPT} — agent must fix it, not create it"
    )


def test_rawcount_script_crashes_with_bigint():
    """The initial script must fail with BigInt serialization error."""
    result = subprocess.run(
        ["node", "rawcount.js"], capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode != 0, (
        "rawcount.js must crash (BigInt serialization error) before the fix is applied"
    )
    combined = result.stdout + result.stderr
    assert "BigInt" in combined or "bigint" in combined.lower() or "serialize" in combined.lower(), (
        f"Script must fail with a BigInt-related error; got stdout={result.stdout!r}, stderr={result.stderr!r}"
    )


def test_result_file_does_not_exist():
    assert not os.path.isfile(os.path.join(PROJECT_DIR, "rawcount_result.json")), \
        "rawcount_result.json must not exist yet"
