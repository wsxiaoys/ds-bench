import csv
import importlib.util
import os

PROJECT_DIR = "/home/user/project"
DATA_FILE = os.path.join(PROJECT_DIR, "data", "sales.csv")


def test_altair_importable():
    assert importlib.util.find_spec("altair") is not None, \
        "The 'altair' library is not importable in the environment."


def test_pandas_importable():
    assert importlib.util.find_spec("pandas") is not None, \
        "The 'pandas' library is not importable in the environment."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), \
        f"Project directory {PROJECT_DIR} does not exist."


def test_data_dir_exists():
    data_dir = os.path.join(PROJECT_DIR, "data")
    assert os.path.isdir(data_dir), \
        f"Data directory {data_dir} does not exist."


def test_sales_csv_exists():
    assert os.path.isfile(DATA_FILE), \
        f"Input data file {DATA_FILE} does not exist."


def test_sales_csv_has_expected_columns():
    with open(DATA_FILE, newline="") as f:
        reader = csv.reader(f)
        header = next(reader, None)
    assert header is not None, f"{DATA_FILE} is empty; expected a header row."
    normalized = [c.strip() for c in header]
    for col in ("date", "category", "sales"):
        assert col in normalized, \
            f"Expected column '{col}' in {DATA_FILE}, found header: {normalized}."


def test_sales_csv_has_rows():
    with open(DATA_FILE, newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    assert len(rows) > 0, f"{DATA_FILE} contains no data rows."
    categories = {(r.get("category") or "").strip() for r in rows}
    categories.discard("")
    assert len(categories) >= 2, \
        f"Expected at least 2 distinct categories in {DATA_FILE}, found: {sorted(categories)}."
