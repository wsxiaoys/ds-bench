import os
import importlib

import pytest

PROJECT_DIR = "/home/user/project"
CSV_PATH = os.path.join(PROJECT_DIR, "metrics.csv")


def test_altair_importable():
    try:
        importlib.import_module("altair")
    except Exception as exc:  # pragma: no cover - defensive
        pytest.fail(f"Failed to import the target library 'altair': {exc}")


def test_pandas_importable():
    try:
        importlib.import_module("pandas")
    except Exception as exc:  # pragma: no cover - defensive
        pytest.fail(f"Failed to import 'pandas', required to read the local CSV: {exc}")


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_metrics_csv_exists():
    assert os.path.isfile(CSV_PATH), f"Input data file {CSV_PATH} does not exist."


def test_metrics_csv_has_expected_columns():
    import pandas as pd

    df = pd.read_csv(CSV_PATH)
    for column in ("date", "series", "value"):
        assert column in df.columns, (
            f"Expected column '{column}' in {CSV_PATH}, found columns: {list(df.columns)}"
        )


def test_metrics_csv_has_four_series():
    import pandas as pd

    df = pd.read_csv(CSV_PATH)
    n_series = df["series"].nunique()
    assert n_series == 4, (
        f"Expected exactly 4 distinct values in the 'series' column of {CSV_PATH}, found {n_series}."
    )


def test_metrics_csv_is_non_empty():
    import pandas as pd

    df = pd.read_csv(CSV_PATH)
    assert len(df) > 0, f"Input data file {CSV_PATH} contains no rows."
