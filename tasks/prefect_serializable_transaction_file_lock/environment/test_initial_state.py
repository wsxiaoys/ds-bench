import os
import shutil
import pytest

PROJECT_DIR = "/home/user/prefect-project"

def test_prefect_binary_available():
    assert shutil.which("prefect") is not None, "prefect binary not found in PATH."

def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."

def test_counter_file_exists_and_initialized():
    counter_path = os.path.join(PROJECT_DIR, "counter.txt")
    assert os.path.isfile(counter_path), f"Counter file {counter_path} does not exist."
    with open(counter_path, "r") as f:
        content = f.read().strip()
    assert content == "0", f"Expected initial counter value to be '0', but got '{content}'."
