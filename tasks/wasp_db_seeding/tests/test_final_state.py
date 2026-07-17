import os
import sqlite3
import subprocess

import pytest

PROJECT_DIR = "/home/user/taskhub"
WASP_DIR = os.path.join(PROJECT_DIR, ".wasp")

PLAINTEXT_PASSWORDS = ["Passw0rd!alice", "Passw0rd!bob", "Passw0rd!carol"]
EXPECTED_USERNAMES = ["alice", "bob", "carol"]
EXPECTED_PROJECT_NAMES = ["Inbox", "Website Redesign"]
EXPECTED_TASK_DESCRIPTIONS = ["Draft plan", "Review with team", "Ship it"]


def _run_wasp(args, timeout=1200):
    """Run a wasp CLI command inside the project directory."""
    return subprocess.run(
        ["wasp", *args],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        input="",
        timeout=timeout,
        env=os.environ.copy(),
    )


def _find_db_file():
    """Locate the local SQLite database file managed by Wasp."""
    if not os.path.isdir(WASP_DIR):
        return None
    for root, _dirs, files in os.walk(WASP_DIR):
        if "dev.db" in files:
            return os.path.join(root, "dev.db")
    return None


def _query(db_path, sql, params=()):
    conn = sqlite3.connect(db_path)
    try:
        conn.row_factory = sqlite3.Row
        cur = conn.execute(sql, params)
        return cur.fetchall()
    finally:
        conn.close()


def _scalar(db_path, sql, params=()):
    rows = _query(db_path, sql, params)
    return rows[0][0]


@pytest.fixture(scope="session")
def seeded_db():
    """
    Reset the local database to a clean slate, then run the agent's seed once.

    Deleting the SQLite file and re-running `wasp db migrate-dev` guarantees the
    verified state reflects ONLY the agent's final seed code, independent of any
    data left behind while the agent iterated.
    """
    existing = _find_db_file()
    if existing and os.path.exists(existing):
        os.remove(existing)

    migrate = _run_wasp(["db", "migrate-dev", "--name", "verify"])
    assert migrate.returncode == 0, (
        "`wasp db migrate-dev` failed while preparing a clean database.\n"
        f"stdout:\n{migrate.stdout}\nstderr:\n{migrate.stderr}"
    )

    seed = _run_wasp(["db", "seed", "devSeed"])
    assert seed.returncode == 0, (
        "`wasp db seed devSeed` failed. The seed function must be wired under "
        "app.db.seeds and runnable by that exact name.\n"
        f"stdout:\n{seed.stdout}\nstderr:\n{seed.stderr}"
    )

    db_path = _find_db_file()
    assert db_path is not None and os.path.getsize(db_path) > 0, (
        "Could not locate a non-empty SQLite database (dev.db) after seeding."
    )
    return db_path


def test_users_created_via_auth(seeded_db):
    rows = _query(
        seeded_db,
        'SELECT "providerUserId" FROM "AuthIdentity" '
        "WHERE \"providerName\" = 'username' ORDER BY \"providerUserId\";",
    )
    usernames = [r[0] for r in rows]
    assert usernames == EXPECTED_USERNAMES, (
        f"Expected username identities {EXPECTED_USERNAMES}, got {usernames}."
    )

    user_count = _scalar(seeded_db, 'SELECT COUNT(*) FROM "User";')
    assert user_count == 3, f"Expected exactly 3 User rows, got {user_count}."

    auth_count = _scalar(seeded_db, 'SELECT COUNT(*) FROM "Auth";')
    assert auth_count == 3, f"Expected exactly 3 Auth rows, got {auth_count}."


def test_passwords_are_hashed(seeded_db):
    rows = _query(
        seeded_db,
        'SELECT "providerData" FROM "AuthIdentity" '
        "WHERE \"providerName\" = 'username';",
    )
    assert len(rows) == 3, f"Expected 3 username identities, got {len(rows)}."
    for r in rows:
        provider_data = r[0] or ""
        assert "hashedPassword" in provider_data, (
            "Each username identity's providerData must contain a 'hashedPassword' "
            f"field. Got: {provider_data!r}"
        )
        for plain in PLAINTEXT_PASSWORDS:
            assert plain not in provider_data, (
                f"Plain-text password {plain!r} must NOT be stored in providerData: "
                f"{provider_data!r}"
            )


def test_projects_seeded(seeded_db):
    project_count = _scalar(seeded_db, 'SELECT COUNT(*) FROM "Project";')
    assert project_count == 6, f"Expected exactly 6 Project rows, got {project_count}."

    names = [
        r[0]
        for r in _query(
            seeded_db, 'SELECT DISTINCT "name" FROM "Project" ORDER BY "name";'
        )
    ]
    assert names == sorted(EXPECTED_PROJECT_NAMES), (
        f"Expected distinct project names {sorted(EXPECTED_PROJECT_NAMES)}, got {names}."
    )

    # Every user must own exactly one 'Inbox' and one 'Website Redesign'.
    per_user = _query(
        seeded_db,
        'SELECT "userId", COUNT(*) AS c FROM "Project" GROUP BY "userId";',
    )
    assert len(per_user) == 3, (
        f"Expected projects owned by 3 distinct users, got {len(per_user)} groups."
    )
    for row in per_user:
        assert row[1] == 2, (
            f"Expected each user to own exactly 2 projects, user {row[0]} has {row[1]}."
        )


def test_tasks_seeded(seeded_db):
    task_count = _scalar(seeded_db, 'SELECT COUNT(*) FROM "Task";')
    assert task_count == 18, f"Expected exactly 18 Task rows, got {task_count}."

    descriptions = [
        r[0]
        for r in _query(
            seeded_db,
            'SELECT DISTINCT "description" FROM "Task" ORDER BY "description";',
        )
    ]
    assert descriptions == sorted(EXPECTED_TASK_DESCRIPTIONS), (
        f"Expected distinct task descriptions {sorted(EXPECTED_TASK_DESCRIPTIONS)}, "
        f"got {descriptions}."
    )

    done_count = _scalar(seeded_db, 'SELECT COUNT(*) FROM "Task" WHERE "isDone" = 1;')
    assert done_count == 6, f"Expected exactly 6 completed tasks, got {done_count}."

    draft_done = _scalar(
        seeded_db,
        "SELECT COUNT(*) FROM \"Task\" WHERE \"description\" = 'Draft plan' "
        'AND "isDone" = 1;',
    )
    assert draft_done == 6, (
        f"Expected all 6 'Draft plan' tasks to be done, got {draft_done}."
    )

    others_not_done = _scalar(
        seeded_db,
        "SELECT COUNT(*) FROM \"Task\" WHERE \"description\" IN "
        "('Review with team','Ship it') AND \"isDone\" = 0;",
    )
    assert others_not_done == 12, (
        "Expected the 12 'Review with team'/'Ship it' tasks to be not done, "
        f"got {others_not_done}."
    )


def test_relational_integrity(seeded_db):
    orphan_tasks = _scalar(
        seeded_db,
        'SELECT COUNT(*) FROM "Task" t LEFT JOIN "Project" p '
        'ON t."projectId" = p."id" WHERE p."id" IS NULL;',
    )
    assert orphan_tasks == 0, f"Found {orphan_tasks} Task rows without a valid Project."

    orphan_projects = _scalar(
        seeded_db,
        'SELECT COUNT(*) FROM "Project" p LEFT JOIN "User" u '
        'ON p."userId" = u."id" WHERE u."id" IS NULL;',
    )
    assert orphan_projects == 0, (
        f"Found {orphan_projects} Project rows without a valid User."
    )


def test_seed_is_idempotent(seeded_db):
    # The fixture already seeded once; run two more times for a total of three runs.
    for i in range(2):
        result = _run_wasp(["db", "seed", "devSeed"])
        assert result.returncode == 0, (
            f"Re-running `wasp db seed devSeed` (run #{i + 2}) failed.\n"
            f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
        )

    counts = {
        "User": _scalar(seeded_db, 'SELECT COUNT(*) FROM "User";'),
        "Auth": _scalar(seeded_db, 'SELECT COUNT(*) FROM "Auth";'),
        "AuthIdentity": _scalar(
            seeded_db,
            'SELECT COUNT(*) FROM "AuthIdentity" WHERE "providerName" = \'username\';',
        ),
        "Project": _scalar(seeded_db, 'SELECT COUNT(*) FROM "Project";'),
        "Task": _scalar(seeded_db, 'SELECT COUNT(*) FROM "Task";'),
    }
    expected = {"User": 3, "Auth": 3, "AuthIdentity": 3, "Project": 6, "Task": 18}
    assert counts == expected, (
        "Seeding is not idempotent: repeated `wasp db seed devSeed` runs changed the "
        f"row counts. Expected {expected}, got {counts}."
    )
