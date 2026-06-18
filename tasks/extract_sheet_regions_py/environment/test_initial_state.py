import importlib
import os

import pytest


PROJECT_DIR = "/home/user/project"
DATA_DIR = os.path.join(PROJECT_DIR, "data")
SAMPLE_XLSX = os.path.join(DATA_DIR, "sales.xlsx")


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )


def test_data_dir_exists():
    assert os.path.isdir(DATA_DIR), (
        f"Sample data directory {DATA_DIR} does not exist."
    )


def test_sample_xlsx_exists():
    assert os.path.isfile(SAMPLE_XLSX), (
        f"Sample spreadsheet {SAMPLE_XLSX} is missing from the initial environment."
    )
    assert os.path.getsize(SAMPLE_XLSX) > 0, (
        f"Sample spreadsheet {SAMPLE_XLSX} exists but is empty."
    )


def test_sample_xlsx_is_real_xlsx():
    # XLSX files are zip archives that start with the bytes "PK".
    with open(SAMPLE_XLSX, "rb") as f:
        magic = f.read(2)
    assert magic == b"PK", (
        f"Sample spreadsheet {SAMPLE_XLSX} does not appear to be a valid .xlsx (zip) file."
    )


def test_llama_cloud_sdk_importable():
    try:
        importlib.import_module("llama_cloud")
    except ImportError as exc:  # pragma: no cover
        pytest.fail(f"llama_cloud SDK is not importable: {exc}")


def test_llama_cloud_api_key_env_var_set():
    value = os.environ.get("LLAMA_CLOUD_API_KEY", "")
    assert value, (
        "LLAMA_CLOUD_API_KEY environment variable is not set in the task environment."
    )
