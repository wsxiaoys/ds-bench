import os
import re
import sqlite3
import glob

PROJECT_DIR = "/home/user/myproject"
SCHEMA_PATH = os.path.join(PROJECT_DIR, "prisma", "schema.prisma")
MIGRATIONS_DIR = os.path.join(PROJECT_DIR, "prisma", "migrations")
DB_PATH = os.path.join(PROJECT_DIR, "prisma", "dev.db")


def test_migrations_directory_exists():
    assert os.path.isdir(MIGRATIONS_DIR), (
        f"prisma/migrations directory must exist at {MIGRATIONS_DIR} after running "
        "'npx prisma migrate dev --name init'"
    )


def test_migration_subdirectory_exists():
    entries = [
        e for e in os.listdir(MIGRATIONS_DIR)
        if os.path.isdir(os.path.join(MIGRATIONS_DIR, e)) and not e.startswith(".")
    ]
    assert len(entries) >= 1, (
        f"At least one migration subdirectory must exist inside {MIGRATIONS_DIR}; "
        f"found: {entries}"
    )


def test_migration_sql_file_exists():
    sql_files = glob.glob(os.path.join(MIGRATIONS_DIR, "**", "*.sql"), recursive=True)
    assert len(sql_files) >= 1, (
        f"At least one .sql migration file must exist under {MIGRATIONS_DIR}; "
        "none were found"
    )


def test_migration_name_contains_init():
    subdirs = [
        e for e in os.listdir(MIGRATIONS_DIR)
        if os.path.isdir(os.path.join(MIGRATIONS_DIR, e)) and not e.startswith(".")
    ]
    assert any("init" in d.lower() for d in subdirs), (
        f"A migration directory whose name contains 'init' must exist in "
        f"{MIGRATIONS_DIR}; found subdirs: {subdirs}"
    )


def test_sqlite_db_file_exists():
    assert os.path.isfile(DB_PATH), (
        f"SQLite database file must exist at {DB_PATH} after running the migration"
    )


def test_sqlite_db_is_valid():
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
        conn.close()
    except Exception as e:
        raise AssertionError(
            f"dev.db at {DB_PATH} must be a valid SQLite database; error: {e}"
        )


def test_user_table_exists_in_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='User'"
    )
    row = cursor.fetchone()
    conn.close()
    assert row is not None, (
        "A 'User' table must exist in the SQLite database after migration"
    )


def test_schema_contains_model_user():
    with open(SCHEMA_PATH, "r") as f:
        content = f.read()
    assert "model User" in content, (
        "schema.prisma must contain 'model User' block"
    )


def test_schema_user_model_has_email_field():
    with open(SCHEMA_PATH, "r") as f:
        content = f.read()
    assert "email" in content, (
        "schema.prisma User model must define an 'email' field"
    )


def test_schema_user_model_email_is_unique():
    with open(SCHEMA_PATH, "r") as f:
        content = f.read()
    # Check that @unique appears in the vicinity of email
    assert re.search(r"email\s+String\s+@unique", content), (
        "schema.prisma must define 'email String @unique' on the User model"
    )


def test_schema_user_model_has_name_field():
    with open(SCHEMA_PATH, "r") as f:
        content = f.read()
    assert "name" in content, (
        "schema.prisma User model must define a 'name' field"
    )


def test_schema_user_model_name_is_optional():
    with open(SCHEMA_PATH, "r") as f:
        content = f.read()
    # Optional String fields use `String?` in Prisma
    assert re.search(r"name\s+String\?", content), (
        "schema.prisma must define 'name String?' (optional) on the User model"
    )


def test_schema_user_model_has_id_field():
    with open(SCHEMA_PATH, "r") as f:
        content = f.read()
    assert re.search(r"id\s+Int\s+@id", content), (
        "schema.prisma must define 'id Int @id' on the User model"
    )


def test_migration_sql_creates_user_table():
    sql_files = glob.glob(os.path.join(MIGRATIONS_DIR, "**", "*.sql"), recursive=True)
    assert sql_files, "At least one migration SQL file must exist"
    combined_sql = ""
    for path in sql_files:
        with open(path, "r") as f:
            combined_sql += f.read()
    assert re.search(r"CREATE TABLE\s+.*[\"']?User[\"']?", combined_sql, re.IGNORECASE), (
        "Migration SQL file must contain a CREATE TABLE statement for the User table"
    )
