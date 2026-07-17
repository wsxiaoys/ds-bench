import glob
import os
import re
import shutil
import socket
import subprocess
import time

import pytest
import requests
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/taskvault"
SCHEMA_PRISMA = os.path.join(PROJECT_DIR, "schema.prisma")
ENV_SERVER = os.path.join(PROJECT_DIR, ".env.server")
MIGRATIONS_DIR = os.path.join(PROJECT_DIR, "migrations")

# Use the explicit IPv4 loopback everywhere to avoid IPv6 (::1) resolution issues.
HOST = "127.0.0.1"
SERVER_PORT = 3001
BASE_URL = f"http://{HOST}:{SERVER_PORT}"
STATS_URL = f"{BASE_URL}/api/stats"

# The local PostgreSQL server provided by the environment.
DB_URL = "postgresql://postgres:postgres@127.0.0.1:5432/taskvault"


def _psql(sql, check=True):
    """Run a single SQL statement against the local PostgreSQL via psql."""
    assert shutil.which("psql") is not None, "The 'psql' client binary was not found in PATH."
    result = subprocess.run(
        ["psql", DB_URL, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql],
        capture_output=True,
        text=True,
    )
    if check:
        assert result.returncode == 0, (
            f"psql command failed for SQL {sql!r}: stdout={result.stdout!r} stderr={result.stderr!r}"
        )
    return result


# ---------------------------------------------------------------------------
# Static file / configuration checks (no running app required).
# ---------------------------------------------------------------------------

def test_schema_provider_switched_to_postgresql():
    with open(SCHEMA_PRISMA) as f:
        content = f.read()
    assert re.search(r'provider\s*=\s*"postgresql"', content), (
        "Expected schema.prisma datasource provider to be \"postgresql\" after the migration."
    )
    assert re.search(r'url\s*=\s*env\(\s*"DATABASE_URL"\s*\)', content), (
        "Expected schema.prisma datasource url to be env(\"DATABASE_URL\")."
    )


def test_database_url_configured_for_local_postgres():
    assert os.path.isfile(ENV_SERVER), (
        f"Expected {ENV_SERVER} to exist and configure DATABASE_URL for the local PostgreSQL server."
    )
    with open(ENV_SERVER) as f:
        content = f.read()
    match = re.search(r"DATABASE_URL\s*=\s*\"?(postgresql://[^\s\"']+)", content)
    assert match, "Expected .env.server to define DATABASE_URL with a postgresql:// connection string."
    url = match.group(1)
    assert ("localhost" in url) or ("127.0.0.1" in url), (
        f"Expected DATABASE_URL to point at a local PostgreSQL server, got: {url}"
    )


def test_migration_lock_is_postgresql():
    lock_path = os.path.join(MIGRATIONS_DIR, "migration_lock.toml")
    assert os.path.isfile(lock_path), f"Expected {lock_path} to exist after regenerating migrations."
    with open(lock_path) as f:
        content = f.read()
    assert re.search(r'provider\s*=\s*"postgresql"', content), (
        "Expected migrations/migration_lock.toml to report the \"postgresql\" provider."
    )
    assert not re.search(r'provider\s*=\s*"sqlite"', content), (
        "migrations/migration_lock.toml still references the \"sqlite\" provider."
    )


def test_new_migration_creates_expected_tables():
    sql_files = glob.glob(os.path.join(MIGRATIONS_DIR, "**", "migration.sql"), recursive=True)
    assert sql_files, f"Expected at least one migration.sql file under {MIGRATIONS_DIR}."
    combined = ""
    for path in sql_files:
        with open(path) as f:
            combined += f.read() + "\n"
    assert re.search(r'CREATE TABLE\s+"?Task"?', combined), (
        "Expected the regenerated migration to create the Task table."
    )
    assert re.search(r'CREATE TABLE\s+"?EventLog"?', combined), (
        "Expected the regenerated migration to create the EventLog table (used by the PgBoss job)."
    )


# ---------------------------------------------------------------------------
# Fixtures: prepare the database, then start the Wasp app.
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def prepared_db():
    """Apply migrations and reset the Task/EventLog tables to a known baseline.

    This MUST happen before the app starts so that the startup PgBoss job's
    effect on EventLog can be measured deterministically.
    """
    migrate = subprocess.run(
        ["wasp", "db", "migrate-dev"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        stdin=subprocess.DEVNULL,
        timeout=600,
    )
    print("=== wasp db migrate-dev stdout ===")
    print(migrate.stdout)
    print("=== wasp db migrate-dev stderr ===")
    print(migrate.stderr)
    assert migrate.returncode == 0, (
        f"'wasp db migrate-dev' failed against PostgreSQL: {migrate.stderr}"
    )
    # Reset to a known baseline. Use check=False so a missing table (i.e. an
    # incomplete solution) surfaces as a clear assertion in the relevant test
    # rather than crashing this fixture.
    _psql('TRUNCATE TABLE "Task" RESTART IDENTITY CASCADE;', check=False)
    _psql('TRUNCATE TABLE "EventLog" RESTART IDENTITY CASCADE;', check=False)
    return DB_URL


@pytest.fixture(scope="session")
def start_app(xprocess, prepared_db):
    class Starter(ProcessStarter):
        name = "wasp_app"
        args = ["wasp", "start"]
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 600
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex((HOST, SERVER_PORT)) != 0:
                    return False
            try:
                resp = requests.get(STATS_URL, timeout=20)
                return resp.status_code == 200
            except requests.RequestException:
                return False

    info = xprocess.getinfo(Starter.name)
    printed = 0

    def capture_logs(tag):
        nonlocal printed
        try:
            with open(info.logpath, "r") as f:
                all_lines = f.readlines()
        except OSError:
            all_lines = []
        new_lines = all_lines[printed:]
        printed = len(all_lines)
        print(f"===== [{tag}] wasp start log =====")
        print("".join(new_lines))
        print(f"===== [{tag}] end wasp start log =====")

    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield BASE_URL

    capture_logs("TEARDOWN")
    info.terminate()


# ---------------------------------------------------------------------------
# Live-app / database checks.
# ---------------------------------------------------------------------------

def test_stats_endpoint_reads_from_postgres(start_app):
    """Insert Task rows directly into PostgreSQL and confirm the live app reads them."""
    _psql(
        "INSERT INTO \"Task\" (description, \"isDone\") "
        "VALUES ('alpha', false), ('beta', false), ('gamma', false);"
    )
    resp = requests.get(STATS_URL, timeout=30)
    assert resp.status_code == 200, (
        f"GET /api/stats returned status {resp.status_code}, expected 200. Body: {resp.text}"
    )
    data = resp.json()
    assert "taskCount" in data, f"Expected JSON with a 'taskCount' key, got: {data}"
    assert data["taskCount"] == 3, (
        f"Expected taskCount == 3 (3 tasks inserted into PostgreSQL), got: {data.get('taskCount')}"
    )


def test_pgboss_schema_created(start_app):
    """PgBoss (a PostgreSQL-only feature) creates a 'pgboss' schema when it starts."""
    deadline = time.time() + 60
    found = False
    last = ""
    while time.time() < deadline:
        result = _psql(
            "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'pgboss';",
            check=False,
        )
        last = result.stdout.strip()
        if last == "pgboss":
            found = True
            break
        time.sleep(3)
    assert found, (
        "Expected a 'pgboss' schema in the PostgreSQL database, indicating the PgBoss "
        f"job executor started against PostgreSQL. Last psql output: {last!r}"
    )


def test_startup_job_wrote_event_log(start_app):
    """The PgBoss job runs on server startup and inserts exactly one EventLog row."""
    deadline = time.time() + 60
    count = 0
    while time.time() < deadline:
        result = _psql('SELECT COUNT(*) FROM "EventLog";', check=False)
        text = result.stdout.strip()
        if text.isdigit():
            count = int(text)
            if count >= 1:
                break
        time.sleep(3)
    assert count >= 1, (
        "Expected at least one EventLog row after the server started (EventLog was truncated "
        f"before startup), confirming the PgBoss startup job ran. Found {count} rows."
    )
    row = _psql(
        'SELECT message, "createdAt" FROM "EventLog" ORDER BY id DESC LIMIT 1;'
    )
    parts = row.stdout.strip().split("|")
    assert len(parts) == 2, f"Unexpected EventLog row format: {row.stdout!r}"
    message, created_at = parts[0].strip(), parts[1].strip()
    assert message, "Expected the newest EventLog row to have a non-empty 'message'."
    assert created_at, "Expected the newest EventLog row to have a non-null 'createdAt' timestamp."
