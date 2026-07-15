import csv
import importlib.util
import os

PROJECT_DIR = "/home/user/altair_splom"
DATA_CSV = os.path.join(PROJECT_DIR, "data", "measurements.csv")

EXPECTED_QUANT_COLUMNS = {"temperature", "pressure", "humidity", "vibration"}
EXPECTED_CATEGORICAL_COLUMN = "machine_class"
EXPECTED_CLASSES = {"A", "B", "C"}


def test_altair_importable():
    assert importlib.util.find_spec("altair") is not None, \
        "The 'altair' library is not importable in the environment."


def test_pandas_importable():
    assert importlib.util.find_spec("pandas") is not None, \
        "The 'pandas' library is not importable in the environment."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), \
        f"Project directory {PROJECT_DIR} does not exist."


def test_dataset_exists():
    assert os.path.isfile(DATA_CSV), \
        f"Input dataset {DATA_CSV} does not exist."


def test_dataset_has_expected_columns():
    with open(DATA_CSV, newline="") as f:
        reader = csv.DictReader(f)
        header = reader.fieldnames or []
    header_set = set(header)
    missing_quant = EXPECTED_QUANT_COLUMNS - header_set
    assert not missing_quant, \
        f"Dataset is missing expected quantitative columns: {missing_quant}."
    assert EXPECTED_CATEGORICAL_COLUMN in header_set, \
        f"Dataset is missing expected categorical column '{EXPECTED_CATEGORICAL_COLUMN}'."


def test_dataset_has_expected_rows_and_classes():
    with open(DATA_CSV, newline="") as f:
        rows = list(csv.DictReader(f))
    assert len(rows) >= 30, \
        f"Dataset should contain a meaningful number of rows, found {len(rows)}."
    classes = {row[EXPECTED_CATEGORICAL_COLUMN] for row in rows}
    assert EXPECTED_CLASSES.issubset(classes), \
        f"Dataset should contain machine classes {EXPECTED_CLASSES}, found {classes}."


def test_chart_html_not_yet_created():
    chart_path = os.path.join(PROJECT_DIR, "chart.html")
    assert not os.path.exists(chart_path), \
        "chart.html should not exist before the task begins; the executor must create it."
