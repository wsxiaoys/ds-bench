import csv
import importlib
import os

import pytest

PROJECT_DIR = "/home/user/altair_chart"
DATA_CSV = os.path.join(PROJECT_DIR, "data", "marketing.csv")
EXPECTED_COLUMNS = {"spend", "sales", "region"}
EXPECTED_REGIONS = {"North", "South", "West"}


def test_altair_importable():
    try:
        importlib.import_module("altair")
    except Exception as exc:  # noqa: BLE001
        pytest.fail(f"Expected the 'altair' library to be importable, but got: {exc}")


def test_pandas_importable():
    try:
        importlib.import_module("pandas")
    except Exception as exc:  # noqa: BLE001
        pytest.fail(f"Expected the 'pandas' library to be importable, but got: {exc}")


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_data_csv_exists():
    assert os.path.isfile(DATA_CSV), f"Input dataset {DATA_CSV} does not exist."


def test_data_csv_has_expected_columns():
    with open(DATA_CSV, newline="") as f:
        reader = csv.DictReader(f)
        fieldnames = set(reader.fieldnames or [])
    assert EXPECTED_COLUMNS.issubset(fieldnames), (
        f"Dataset {DATA_CSV} must contain columns {sorted(EXPECTED_COLUMNS)}, "
        f"but found {sorted(fieldnames)}."
    )


def test_data_csv_has_expected_regions():
    with open(DATA_CSV, newline="") as f:
        reader = csv.DictReader(f)
        regions = {row["region"] for row in reader}
    assert EXPECTED_REGIONS.issubset(regions), (
        f"Dataset {DATA_CSV} must contain regions {sorted(EXPECTED_REGIONS)}, "
        f"but found {sorted(regions)}."
    )


def test_output_html_not_present_initially():
    output_html = os.path.join(PROJECT_DIR, "output", "chart.html")
    assert not os.path.isfile(output_html), (
        f"Output artifact {output_html} should not exist before the task is performed."
    )
