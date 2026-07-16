import csv
import importlib
import os

PROJECT_DIR = "/home/user/project"
DATA_CSV = os.path.join(PROJECT_DIR, "data", "category_volume.csv")


def test_altair_importable():
    try:
        importlib.import_module("altair")
    except Exception as exc:  # noqa: BLE001
        assert False, f"Failed to import altair: {exc}"


def test_pandas_importable():
    try:
        importlib.import_module("pandas")
    except Exception as exc:  # noqa: BLE001
        assert False, f"Failed to import pandas: {exc}"


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_data_csv_exists():
    assert os.path.isfile(DATA_CSV), f"Input dataset {DATA_CSV} does not exist."


def test_data_csv_header_and_rows():
    with open(DATA_CSV, newline="") as f:
        reader = csv.reader(f)
        header = next(reader, None)
        assert header == ["date", "category", "volume"], (
            f"Expected header ['date', 'category', 'volume'] in {DATA_CSV}, got {header}."
        )
        rows = list(reader)
    assert len(rows) > 0, f"Input dataset {DATA_CSV} contains no data rows."


def test_output_html_not_present_yet():
    output_html = os.path.join(PROJECT_DIR, "streamgraph.html")
    assert not os.path.exists(output_html), (
        f"Output artifact {output_html} should not exist before the task is performed."
    )
