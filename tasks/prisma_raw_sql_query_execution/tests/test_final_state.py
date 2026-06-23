import os
import json
import subprocess

PROJECT_DIR = "/home/user/myproject"
RESULT_FILE = os.path.join(PROJECT_DIR, "rawsql_result.json")


def test_rawsql_script_runs():
    """Priority 1: Execute the agent's script."""
    result = subprocess.run(
        ["node", "rawsql.js"], capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"node rawsql.js must exit 0; stderr={result.stderr.strip()}"


def test_result_file_exists():
    assert os.path.isfile(RESULT_FILE), f"rawsql_result.json must exist at {RESULT_FILE}"


def test_count_result_is_three():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    count_result = data.get("countResult", [])
    assert len(count_result) >= 1, "countResult must be a non-empty array"
    # SQLite returns BigInt as string in $queryRaw; check value flexibly
    cnt = count_result[0].get("cnt", count_result[0].get("COUNT(*)", None))
    assert str(cnt) == "3" or cnt == 3, (
        f"Count query must return 3; got: {cnt}"
    )


def test_users_array_has_three():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    users = data.get("users", [])
    assert len(users) == 3, f"users array must have 3 entries; got {len(users)}"


def test_users_names_are_uppercase():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    users = data.get("users", [])
    for user in users:
        name = user.get("name", "")
        assert name == name.upper(), (
            f"All user names must be uppercase after $executeRaw; got: {name!r}"
        )


def test_db_names_are_uppercase():
    """Priority 1: Verify via live DB query."""
    result = subprocess.run(
        ["node", "-e",
         "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); "
         "p.user.findMany().then(u => { console.log(JSON.stringify(u.map(x=>x.name))); p.$disconnect(); })"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"stderr={result.stderr.strip()}"
    names = json.loads(result.stdout.strip())
    for name in names:
        assert name == name.upper(), f"DB user name must be uppercase; got: {name!r}"
    assert set(names) == {"ALICE", "BOB", "CAROL"}, (
        f"Expected uppercase names ALICE, BOB, CAROL; got: {names}"
    )
