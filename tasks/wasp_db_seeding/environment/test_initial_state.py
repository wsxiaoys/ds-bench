import os
import shutil

import pytest

PROJECT_DIR = "/home/user/taskhub"
MAIN_WASP = os.path.join(PROJECT_DIR, "main.wasp.ts")
SCHEMA_PRISMA = os.path.join(PROJECT_DIR, "schema.prisma")


def test_wasp_binary_available():
    assert shutil.which("wasp") is not None, "The 'wasp' binary was not found in PATH."


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_main_wasp_ts_exists():
    assert os.path.isfile(MAIN_WASP), f"Wasp config file {MAIN_WASP} does not exist."


def test_schema_prisma_exists():
    assert os.path.isfile(SCHEMA_PRISMA), f"Prisma schema {SCHEMA_PRISMA} does not exist."


def test_auth_is_configured():
    with open(MAIN_WASP) as f:
        content = f.read()
    assert "auth" in content and "usernameAndPassword" in content, (
        "Expected username & password authentication to be pre-configured in main.wasp.ts."
    )


def test_data_model_present():
    with open(SCHEMA_PRISMA) as f:
        content = f.read()
    for model in ("model User", "model Project", "model Task"):
        assert model in content, f"Expected '{model}' to be defined in schema.prisma."


def test_seeds_not_configured_yet():
    with open(MAIN_WASP) as f:
        content = f.read()
    assert "seeds" not in content, (
        "The 'seeds' configuration should not exist yet; adding it is part of the task."
    )
