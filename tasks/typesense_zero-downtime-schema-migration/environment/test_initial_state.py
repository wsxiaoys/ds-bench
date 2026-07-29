import os

PROJECT_DIR = "/home/user/project"
DATA_DIR = "/home/user/project/typesense-data"
START_SCRIPT = "/home/user/project/start-typesense.sh"
BINARY_PATH = "/usr/local/bin/typesense-server"


def test_typesense_binary_available():
    assert os.path.isfile(BINARY_PATH) and os.access(BINARY_PATH, os.X_OK), (
        f"Typesense server binary not found or not executable at {BINARY_PATH}."
    )


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_data_directory_exists():
    assert os.path.isdir(DATA_DIR), (
        f"Typesense data directory {DATA_DIR} does not exist; seeded state is missing."
    )


def test_start_script_exists():
    assert os.path.isfile(START_SCRIPT), (
        f"Typesense start helper script {START_SCRIPT} does not exist."
    )

    # NOTE: per instruction.md, starting the Typesense server against the
    # seeded data directory (via this start script) is the agent's own first
    # step for this task. This initial-state test intentionally does not
    # start the server itself and does not assert on its running/health
    # state — doing so would perform (or presuppose) part of the agent's
    # work. Once started, the pre-seeded `products_v1` collection and
    # `products` alias described in instruction.md become visible again
    # because the data directory already contains them on disk.
