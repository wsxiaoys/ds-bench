import os
import re

import pandas as pd
import pytest


PROJECT_DIR = "/home/user/project"
OUTPUT_DIR = os.path.join(PROJECT_DIR, "output")
LOG_FILE = os.path.join(OUTPUT_DIR, "sheets.log")

EXPECTED_REVENUES = {1200, 1500, 1800, 2100, 2400}

LOCATION_RE = re.compile(r"^[A-Z]+\d+:[A-Z]+\d+$")
REGION_LINE_RE = re.compile(
    r"^Region:\s+(?P<region_id>\S+)\s+sheet=(?P<sheet>\S+)\s+location=(?P<location>\S+)\s*$"
)
PARQUET_LINE_RE = re.compile(r"^Parquet:\s+(?P<path>\S+)\s*$")


@pytest.fixture(scope="module")
def log_text():
    assert os.path.isfile(LOG_FILE), (
        f"Expected log file {LOG_FILE} does not exist after task execution."
    )
    assert os.path.getsize(LOG_FILE) > 0, (
        f"Log file {LOG_FILE} exists but is empty."
    )
    with open(LOG_FILE, "r", encoding="utf-8") as f:
        return f.read()


def _find_single(pattern, text, label):
    matches = re.findall(pattern, text, flags=re.MULTILINE)
    assert matches, f"Could not find a `{label}` line in the log file."
    assert len(matches) == 1, (
        f"Expected exactly one `{label}` line in the log, found {len(matches)}: {matches}"
    )
    return matches[0]


def test_log_has_job_id(log_text):
    job_id = _find_single(r"^Job ID:\s+(\S+)\s*$", log_text, "Job ID")
    assert job_id, "Job ID line is present but the job id value is empty."


def test_log_has_success_status(log_text):
    status = _find_single(r"^Job Status:\s+(\S+)\s*$", log_text, "Job Status")
    assert status == "SUCCESS", (
        f"Expected Job Status to be 'SUCCESS', got '{status}'."
    )


def test_log_has_region_count(log_text):
    count_str = _find_single(r"^Region Count:\s+(\d+)\s*$", log_text, "Region Count")
    count = int(count_str)
    assert count >= 1, f"Region Count must be >= 1, got {count}."


def _parse_region_lines(log_text):
    return [
        m.groupdict()
        for m in (REGION_LINE_RE.match(line) for line in log_text.splitlines())
        if m
    ]


def _parse_parquet_lines(log_text):
    return [
        m.group("path")
        for m in (PARQUET_LINE_RE.match(line) for line in log_text.splitlines())
        if m
    ]


def test_region_lines_match_count(log_text):
    count = int(_find_single(r"^Region Count:\s+(\d+)\s*$", log_text, "Region Count"))
    regions = _parse_region_lines(log_text)
    assert len(regions) == count, (
        f"Number of `Region:` lines ({len(regions)}) does not match the declared "
        f"Region Count ({count})."
    )


def test_region_lines_have_valid_format(log_text):
    regions = _parse_region_lines(log_text)
    assert regions, "No `Region:` lines were found in the log."
    for r in regions:
        assert r["region_id"], f"Region id is empty in entry: {r!r}"
        assert r["sheet"], f"Sheet name is empty in entry: {r!r}"
        assert LOCATION_RE.match(r["location"]), (
            f"Region location '{r['location']}' does not look like an Excel range "
            f"(e.g., 'A1:D6')."
        )


def test_parquet_lines_match_region_ids(log_text):
    regions = _parse_region_lines(log_text)
    parquet_paths = _parse_parquet_lines(log_text)
    region_ids_from_regions = {r["region_id"] for r in regions}

    assert len(parquet_paths) == len(regions), (
        f"Expected {len(regions)} `Parquet:` line(s) (one per region), "
        f"found {len(parquet_paths)}."
    )

    region_ids_from_parquet = set()
    for path in parquet_paths:
        m = re.search(r"region_(?P<region_id>[^/]+)\.parquet$", path)
        assert m, (
            f"Parquet path '{path}' does not match the expected naming "
            f"`region_<region_id>.parquet`."
        )
        region_ids_from_parquet.add(m.group("region_id"))

    assert region_ids_from_parquet == region_ids_from_regions, (
        f"Set of region ids referenced by `Parquet:` lines {region_ids_from_parquet} "
        f"does not match the set from `Region:` lines {region_ids_from_regions}."
    )


def test_parquet_files_exist_and_are_valid(log_text):
    parquet_paths = _parse_parquet_lines(log_text)
    assert parquet_paths, "No `Parquet:` lines were found in the log."

    for path in parquet_paths:
        assert path.startswith(OUTPUT_DIR + os.sep), (
            f"Parquet path '{path}' is not under expected output dir {OUTPUT_DIR}."
        )
        assert os.path.isfile(path), f"Parquet file '{path}' does not exist on disk."
        size = os.path.getsize(path)
        assert size > 0, f"Parquet file '{path}' exists but is empty."
        with open(path, "rb") as f:
            magic = f.read(4)
        assert magic == b"PAR1", (
            f"File '{path}' is not a valid Parquet file (missing PAR1 header)."
        )
        df = pd.read_parquet(path)
        assert df.shape[0] >= 1 and df.shape[1] >= 1, (
            f"Parquet file '{path}' loaded as an empty DataFrame "
            f"(shape={df.shape})."
        )


def test_parquet_contents_match_source_revenues(log_text):
    parquet_paths = _parse_parquet_lines(log_text)
    seen_values = set()

    for path in parquet_paths:
        df = pd.read_parquet(path)
        for col in df.columns:
            series = df[col]
            # Try to coerce strings like "1,200" or "1200" to numbers as well.
            numeric = pd.to_numeric(
                series.astype(str).str.replace(",", "", regex=False),
                errors="coerce",
            )
            for value in numeric.dropna().tolist():
                try:
                    seen_values.add(int(value))
                except (TypeError, ValueError):
                    continue

    missing = EXPECTED_REVENUES - seen_values
    assert not missing, (
        f"Expected monthly revenue figures {sorted(EXPECTED_REVENUES)} to all appear "
        f"in the downloaded Parquet data, but these are missing: {sorted(missing)}. "
        f"Observed numeric values (sample): {sorted(list(seen_values))[:25]}"
    )
