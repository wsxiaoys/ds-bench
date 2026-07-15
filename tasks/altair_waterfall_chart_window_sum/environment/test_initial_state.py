import csv
import importlib.util
import os

PROJECT_DIR = "/home/user/project"
DATA_FILE = os.path.join(PROJECT_DIR, "data", "cash_flow.csv")


def test_altair_importable():
    assert importlib.util.find_spec("altair") is not None, (
        "The 'altair' library is not importable in the environment."
    )


def test_pandas_importable():
    assert importlib.util.find_spec("pandas") is not None, (
        "The 'pandas' library is not importable in the environment."
    )


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )


def test_data_dir_exists():
    data_dir = os.path.join(PROJECT_DIR, "data")
    assert os.path.isdir(data_dir), (
        f"Data directory {data_dir} does not exist."
    )


def test_input_csv_exists():
    assert os.path.isfile(DATA_FILE), (
        f"Input data file {DATA_FILE} does not exist."
    )


def test_input_csv_has_expected_rows():
    with open(DATA_FILE, newline="") as f:
        rows = list(csv.DictReader(f))

    assert rows, f"Input data file {DATA_FILE} is empty."

    fieldnames = rows[0].keys()
    assert "label" in fieldnames and "amount" in fieldnames, (
        f"Input CSV must contain 'label' and 'amount' columns, got {list(fieldnames)}."
    )

    labels = [r["label"] for r in rows]
    expected_labels = [
        "Begin",
        "Product A",
        "Product B",
        "Services",
        "Refunds",
        "Tax",
        "End",
    ]
    assert labels == expected_labels, (
        f"Input CSV labels/order must be {expected_labels}, got {labels}."
    )

    amounts = [int(r["amount"]) for r in rows]
    expected_amounts = [4000, 1200, -800, 1500, -600, -900, 0]
    assert amounts == expected_amounts, (
        f"Input CSV amounts must be {expected_amounts}, got {amounts}."
    )


def test_output_html_not_present_initially():
    output_html = os.path.join(PROJECT_DIR, "waterfall.html")
    assert not os.path.exists(output_html), (
        f"Output file {output_html} should not exist before the task begins."
    )
