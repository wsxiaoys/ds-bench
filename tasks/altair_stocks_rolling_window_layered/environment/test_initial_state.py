import csv
import importlib.util
import os

PROJECT_DIR = "/home/user/altair-stocks"
CSV_PATH = os.path.join(PROJECT_DIR, "stocks.csv")
CHART_PATH = os.path.join(PROJECT_DIR, "chart.html")


def test_altair_importable():
    assert importlib.util.find_spec("altair") is not None, \
        "The 'altair' library is not importable in the environment."


def test_pandas_importable():
    assert importlib.util.find_spec("pandas") is not None, \
        "The 'pandas' library is not importable in the environment."


def test_vl_convert_importable():
    assert importlib.util.find_spec("vl_convert") is not None, \
        "The 'vl_convert' package (vl-convert-python) is required for offline HTML export but is not importable."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), \
        f"Project directory {PROJECT_DIR} does not exist."


def test_stocks_csv_exists():
    assert os.path.isfile(CSV_PATH), \
        f"Input data file {CSV_PATH} does not exist."


def test_stocks_csv_has_expected_columns():
    with open(CSV_PATH, newline="") as f:
        reader = csv.reader(f)
        header = next(reader, [])
    for col in ("date", "symbol", "price"):
        assert col in header, \
            f"Column '{col}' is missing from the header of {CSV_PATH} (found: {header})."


def test_stocks_csv_has_expected_symbols_and_rows():
    with open(CSV_PATH, newline="") as f:
        reader = csv.DictReader(f)
        symbols = set()
        row_count = 0
        for row in reader:
            symbols.add(row["symbol"])
            row_count += 1
    for sym in ("AAPL", "GOOG", "MSFT"):
        assert sym in symbols, \
            f"Expected symbol '{sym}' not found in {CSV_PATH} (found symbols: {sorted(symbols)})."
    assert row_count > 100, \
        f"Expected more than 100 data rows in {CSV_PATH}, found {row_count}."


def test_chart_html_not_yet_created():
    assert not os.path.exists(CHART_PATH), \
        f"Output file {CHART_PATH} should not exist before the task is performed."
