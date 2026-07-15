import csv
import importlib.util
import os

PROJECT_DIR = "/home/user/altair-task"
DATA_FILE = os.path.join(PROJECT_DIR, "data", "measurements.csv")


def test_altair_importable():
    assert (
        importlib.util.find_spec("altair") is not None
    ), "The target library 'altair' is not importable in the environment."


def test_pandas_importable():
    assert (
        importlib.util.find_spec("pandas") is not None
    ), "'pandas' is required to read the input CSV but is not importable."


def test_project_dir_exists():
    assert os.path.isdir(
        PROJECT_DIR
    ), f"Project directory {PROJECT_DIR} does not exist."


def test_data_file_exists():
    assert os.path.isfile(
        DATA_FILE
    ), f"Input data file {DATA_FILE} does not exist."


def test_data_file_has_expected_columns():
    with open(DATA_FILE, newline="") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames or []
    assert "group" in fieldnames, "Input CSV is missing the 'group' column."
    assert "response" in fieldnames, "Input CSV is missing the 'response' column."


def test_data_file_contains_four_groups():
    groups = set()
    with open(DATA_FILE, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            groups.add(row["group"])
    for expected in ("A", "B", "C", "D"):
        assert (
            expected in groups
        ), f"Expected group '{expected}' to be present in {DATA_FILE}."
