import csv
import importlib
import os

PROJECT_DIR = "/home/user/altair_boxplot"
DATA_CSV = os.path.join(PROJECT_DIR, "data", "measurements.csv")
EXPECTED_COLUMNS = ["alloy", "treatment", "supplier", "strength_mpa"]


def test_altair_importable():
    try:
        importlib.import_module("altair")
    except Exception as exc:  # pragma: no cover - defensive
        assert False, f"The 'altair' library could not be imported: {exc!r}"


def test_pandas_importable():
    try:
        importlib.import_module("pandas")
    except Exception as exc:  # pragma: no cover - defensive
        assert False, f"The 'pandas' library could not be imported: {exc!r}"


def test_vl_convert_importable():
    try:
        importlib.import_module("vl_convert")
    except Exception as exc:  # pragma: no cover - defensive
        assert False, f"The 'vl_convert' (vl-convert-python) library could not be imported: {exc!r}"


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_output_dir_exists():
    out_dir = os.path.join(PROJECT_DIR, "output")
    assert os.path.isdir(out_dir), f"Output directory {out_dir} does not exist."


def test_dataset_exists():
    assert os.path.isfile(DATA_CSV), f"Input dataset {DATA_CSV} does not exist."


def test_dataset_has_expected_columns():
    with open(DATA_CSV, newline="") as f:
        reader = csv.reader(f)
        header = next(reader, None)
    assert header is not None, f"Dataset {DATA_CSV} is empty (no header row)."
    for col in EXPECTED_COLUMNS:
        assert col in header, f"Dataset {DATA_CSV} is missing expected column '{col}'. Found: {header}"


def test_dataset_has_expected_category_counts():
    alloys, treatments, suppliers = set(), set(), set()
    row_count = 0
    with open(DATA_CSV, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            row_count += 1
            alloys.add(row["alloy"])
            treatments.add(row["treatment"])
            suppliers.add(row["supplier"])
    assert row_count > 0, f"Dataset {DATA_CSV} contains no data rows."
    assert len(alloys) == 3, f"Expected 3 distinct alloys, found {len(alloys)}: {sorted(alloys)}"
    assert len(treatments) == 2, f"Expected 2 distinct treatments, found {len(treatments)}: {sorted(treatments)}"
    assert len(suppliers) == 2, f"Expected 2 distinct suppliers, found {len(suppliers)}: {sorted(suppliers)}"
