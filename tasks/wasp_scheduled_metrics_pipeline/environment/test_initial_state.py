import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/waspmetrics"


def test_wasp_binary_available():
    assert shutil.which("wasp") is not None, "wasp binary not found in PATH."


def test_wasp_version_is_pinned():
    result = subprocess.run(
        ["wasp", "version"],
        capture_output=True,
        text=True,
        timeout=120,
    )
    output = (result.stdout or "") + (result.stderr or "")
    assert "0.25.0" in output, f"Expected Wasp 0.25.0 to be installed, got: {output!r}"


def test_node_and_npm_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_project_is_a_wasp_project():
    spec_file = os.path.join(PROJECT_DIR, "main.wasp.ts")
    assert os.path.isfile(spec_file), f"Wasp spec file {spec_file} does not exist."
    package_json = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(package_json), f"{package_json} does not exist."
    prisma_schema = os.path.join(PROJECT_DIR, "schema.prisma")
    assert os.path.isfile(prisma_schema), f"Prisma schema {prisma_schema} does not exist."


def test_start_script_is_not_provided():
    start_script = os.path.join(PROJECT_DIR, "start.sh")
    assert not os.path.exists(start_script), (
        f"{start_script} already exists, but the executor is expected to create it."
    )


def test_database_url_is_exported():
    database_url = os.environ.get("DATABASE_URL", "")
    assert database_url.startswith("postgres"), (
        f"DATABASE_URL must point to a local PostgreSQL database, got: {database_url!r}"
    )


def test_local_postgresql_is_installed():
    assert shutil.which("psql") is not None, "psql client not found in PATH."
    assert shutil.which("pg_ctl") is not None or shutil.which("postgres") is not None, (
        "No local PostgreSQL server binaries (pg_ctl/postgres) found in PATH."
    )
