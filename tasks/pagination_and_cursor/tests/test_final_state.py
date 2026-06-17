import os
import json
import subprocess

PROJECT_DIR = "/home/user/myproject"
RESULT_FILE = os.path.join(PROJECT_DIR, "paginate_result.json")


def test_paginate_script_runs():
    """Priority 1: Execute the agent's script."""
    result = subprocess.run(
        ["node", "paginate.js"], capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"node paginate.js must exit 0; stderr={result.stderr.strip()}"


def test_result_file_exists():
    assert os.path.isfile(RESULT_FILE), f"paginate_result.json must exist at {RESULT_FILE}"


def test_page1_has_five_users():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    assert len(data.get("page1", [])) == 5, (
        f"page1 must have 5 users; got {len(data.get('page1', []))}"
    )


def test_page2_has_five_users():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    assert len(data.get("page2", [])) == 5, (
        f"page2 must have 5 users; got {len(data.get('page2', []))}"
    )


def test_page1_ids_are_one_to_five():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    ids = [u["id"] for u in data.get("page1", [])]
    assert ids == [1, 2, 3, 4, 5], f"page1 ids must be [1,2,3,4,5]; got {ids}"


def test_page2_ids_are_six_to_ten():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    ids = [u["id"] for u in data.get("page2", [])]
    assert ids == [6, 7, 8, 9, 10], f"page2 ids must be [6,7,8,9,10]; got {ids}"


def test_no_overlap_between_pages():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    ids1 = {u["id"] for u in data.get("page1", [])}
    ids2 = {u["id"] for u in data.get("page2", [])}
    assert ids1.isdisjoint(ids2), (
        f"page1 and page2 must have no overlapping ids; overlap: {ids1 & ids2}"
    )
