import csv
import importlib.util
import os

PROJECT_DIR = "/home/user/project"
DATA_FILE = os.path.join(PROJECT_DIR, "data", "product_sales.csv")


def test_altair_importable():
    assert importlib.util.find_spec("altair") is not None, \
        "The target library 'altair' is not importable in the environment."


def test_pandas_importable():
    assert importlib.util.find_spec("pandas") is not None, \
        "'pandas' is not importable; it is needed to load the local CSV dataset."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), \
        f"Project directory {PROJECT_DIR} does not exist."


def test_data_dir_exists():
    data_dir = os.path.join(PROJECT_DIR, "data")
    assert os.path.isdir(data_dir), \
        f"Data directory {data_dir} does not exist."


def test_dataset_file_exists():
    assert os.path.isfile(DATA_FILE), \
        f"Bundled dataset file {DATA_FILE} does not exist."


def test_dataset_has_expected_columns():
    with open(DATA_FILE, newline="") as f:
        reader = csv.reader(f)
        header = next(reader, None)
    assert header is not None, f"{DATA_FILE} appears to be empty (no header row)."
    normalized = [c.strip() for c in header]
    for column in ("period", "category", "sales"):
        assert column in normalized, \
            f"Expected column '{column}' in {DATA_FILE} header, got {normalized}."


def test_dataset_has_rows():
    with open(DATA_FILE, newline="") as f:
        reader = csv.reader(f)
        rows = [r for r in reader if any(cell.strip() for cell in r)]
    # header + at least a few data rows
    assert len(rows) > 1, f"Dataset {DATA_FILE} does not contain any data rows."
