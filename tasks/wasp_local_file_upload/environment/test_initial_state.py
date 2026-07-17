import os
import shutil

PROJECT_DIR = "/home/user/fileupload"


def test_wasp_binary_available():
    assert shutil.which("wasp") is not None, "wasp binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_main_wasp_exists():
    main_wasp = os.path.join(PROJECT_DIR, "main.wasp")
    assert os.path.isfile(main_wasp), f"Wasp config file {main_wasp} does not exist."


def test_schema_prisma_exists():
    schema = os.path.join(PROJECT_DIR, "schema.prisma")
    assert os.path.isfile(schema), f"Prisma schema file {schema} does not exist."


def test_schema_uses_local_sqlite_provider():
    schema = os.path.join(PROJECT_DIR, "schema.prisma")
    with open(schema) as f:
        content = f.read()
    assert 'provider = "sqlite"' in content, \
        "Expected the schema.prisma datasource to use the local sqlite provider."


def test_auth_is_configured():
    main_wasp = os.path.join(PROJECT_DIR, "main.wasp")
    with open(main_wasp) as f:
        content = f.read()
    assert "usernameAndPassword" in content, \
        "Expected username & password authentication to be configured in main.wasp."


def test_src_dir_exists():
    src = os.path.join(PROJECT_DIR, "src")
    assert os.path.isdir(src), f"Source directory {src} does not exist."
