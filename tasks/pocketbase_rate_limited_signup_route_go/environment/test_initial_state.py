import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/myproject"
POCKETBASE_BIN = "/home/user/myproject/pocketbase"
PB_DATA_DB = "/home/user/myproject/pb_data/data.db"


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )


def test_pocketbase_binary_available():
    assert os.path.isfile(POCKETBASE_BIN) and os.access(POCKETBASE_BIN, os.X_OK), (
        f"PocketBase binary not found or not executable at {POCKETBASE_BIN}."
    )


def test_pocketbase_version_is_0_31_0():
    out = subprocess.run(
        [POCKETBASE_BIN, "--version"],
        capture_output=True,
        text=True,
        timeout=15,
    )
    combined = (out.stdout or "") + (out.stderr or "")
    assert "0.31.0" in combined, (
        f"Expected PocketBase v0.31.0 binary, got: {combined.strip()!r}"
    )


def test_go_toolchain_available():
    assert shutil.which("go") is not None, (
        "Go toolchain not found in PATH; required to build a custom PocketBase middleware."
    )


def test_users_collection_already_migrated():
    # PocketBase itself is not running yet at initial state — starting it
    # (via start.sh) is the agent's own task. Verify the built-in `users`
    # auth collection was already materialized by `pocketbase migrate up`
    # at image build time by reading the on-disk SQLite database directly
    # (read-only), without starting a server.
    import sqlite3

    assert os.path.isfile(PB_DATA_DB), (
        f"Expected pre-migrated PocketBase database at {PB_DATA_DB}."
    )
    conn = sqlite3.connect(f"file:{PB_DATA_DB}?mode=ro", uri=True)
    try:
        rows = conn.execute(
            "SELECT name FROM _collections WHERE name = 'users';"
        ).fetchall()
    finally:
        conn.close()
    assert rows, (
        "Expected the built-in 'users' auth collection to already exist in the "
        "pre-migrated PocketBase database."
    )
