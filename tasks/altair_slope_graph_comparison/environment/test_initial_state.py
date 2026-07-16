import csv
import importlib.util
import os

PROJECT_DIR = "/home/user/project"
DATA_CSV = os.path.join(PROJECT_DIR, "data", "regional_revenue.csv")
OUTPUT_HTML = os.path.join(PROJECT_DIR, "slope_graph.html")

EXPECTED_COLUMNS = ["region", "revenue_2023", "revenue_2024"]
EXPECTED_REGIONS = {"North", "South", "East", "West", "Central", "Mountain"}


def test_altair_importable():
    assert importlib.util.find_spec("altair") is not None, \
        "The 'altair' package must be importable in the task environment."


def test_pandas_importable():
    assert importlib.util.find_spec("pandas") is not None, \
        "The 'pandas' package must be importable in the task environment."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), \
        f"Project directory {PROJECT_DIR} must exist before the task starts."


def test_input_csv_exists():
    assert os.path.isfile(DATA_CSV), \
        f"Input data file {DATA_CSV} must exist before the task starts."


def test_input_csv_columns():
    with open(DATA_CSV, newline="") as f:
        reader = csv.reader(f)
        header = next(reader, None)
    assert header == EXPECTED_COLUMNS, (
        f"Input CSV must have exactly the columns {EXPECTED_COLUMNS}, "
        f"got {header}. The trend/direction must NOT be pre-added as a column."
    )


def test_input_csv_regions():
    with open(DATA_CSV, newline="") as f:
        rows = list(csv.DictReader(f))
    regions = {row["region"] for row in rows}
    assert regions == EXPECTED_REGIONS, (
        f"Input CSV must contain exactly the regions {sorted(EXPECTED_REGIONS)}, "
        f"got {sorted(regions)}."
    )
    assert len(rows) == 6, f"Input CSV must contain exactly 6 region rows, got {len(rows)}."


def test_output_html_not_yet_created():
    assert not os.path.exists(OUTPUT_HTML), (
        f"Output artifact {OUTPUT_HTML} must NOT exist before the task starts; "
        "the executor is expected to create it."
    )
