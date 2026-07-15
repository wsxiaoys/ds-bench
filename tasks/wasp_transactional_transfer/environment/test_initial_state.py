import os
import shutil

PROJECT_DIR = "/home/user/bankapp"


def test_wasp_binary_available():
    assert shutil.which("wasp") is not None, "wasp binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_wasp_config_exists():
    config_path = os.path.join(PROJECT_DIR, "main.wasp")
    assert os.path.isfile(config_path), f"Wasp config file {config_path} does not exist."


def test_prisma_schema_defines_balance():
    schema_path = os.path.join(PROJECT_DIR, "schema.prisma")
    assert os.path.isfile(schema_path), f"Prisma schema {schema_path} does not exist."
    with open(schema_path) as f:
        content = f.read()
    assert "balance" in content, \
        "Expected the pre-existing Prisma schema to define an account balance field."


def test_transfer_action_not_yet_implemented():
    # The transfer logic must not exist in the starting environment.
    config_path = os.path.join(PROJECT_DIR, "main.wasp")
    with open(config_path) as f:
        config = f.read()
    assert "transferFunds" not in config, \
        "The transferFunds Action should not be declared yet in the initial environment."
