import os
import socket
import tempfile

import pytest
import requests
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/app"
HOST = "127.0.0.1"

APP_PORT = 3000
APP_BASE_URL = f"http://{HOST}:{APP_PORT}"

TYPESENSE_BIN = "/usr/local/bin/typesense-server"
TYPESENSE_PORT = 8108
TYPESENSE_BASE_URL = f"http://{HOST}:{TYPESENSE_PORT}"
with open("/etc/typesense-api-key", "r") as f:
    API_KEY = f.read().strip()

# Deterministic dataset expectations (grouped by brand, popularity desc).
EXPECTED_GROUP_TOTALS = {
    "Azura": 5,
    "Boreas": 2,
    "Cirrus": 3,
    "Denali": 4,
    "Everest": 6,
}
GROUP_LIMIT = 3


def _print_logs(logpath, tag, state):
    try:
        with open(logpath, "r") as f:
            content = f.read()
    except OSError:
        content = "<no log file>"
    print(f"===== [{tag}: {state}] logfile begin =====")
    print(content)
    print(f"===== [{tag}: {state}] logfile end   =====")


@pytest.fixture(scope="session")
def browser_verifier():
    return PochiVerifier()


@pytest.fixture(scope="session")
def start_typesense(xprocess):
    """Start a fresh local Typesense v26.0 server on 127.0.0.1:8108."""
    data_dir = tempfile.mkdtemp(prefix="typesense-data-")

    class Starter(ProcessStarter):
        name = "typesense_server"
        args = [
            TYPESENSE_BIN,
            "--data-dir",
            data_dir,
            "--api-key",
            API_KEY,
            "--api-address",
            HOST,
            "--api-port",
            str(TYPESENSE_PORT),
            "--enable-cors",
        ]
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": data_dir,
            "text": True,
        }
        timeout = 120
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex((HOST, TYPESENSE_PORT)) != 0:
                    return False
            try:
                resp = requests.get(f"{TYPESENSE_BASE_URL}/health", timeout=10)
                return resp.status_code == 200 and resp.json().get("ok") is True
            except (requests.RequestException, ValueError):
                return False

    info = xprocess.getinfo(Starter.name)
    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        _print_logs(info.logpath, Starter.name, "STARTED" if started else "FAILED")

    yield

    _print_logs(info.logpath, Starter.name, "TEARDOWN")
    info.terminate()


@pytest.fixture(scope="session")
def start_app(xprocess, start_typesense):
    """Start the grouped-results web application (depends on Typesense)."""

    class Starter(ProcessStarter):
        name = "grouped_results_app"
        args = ["npm", "start"]
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 300
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex((HOST, APP_PORT)) != 0:
                    return False
            try:
                resp = requests.get(f"{APP_BASE_URL}/?q=audio", timeout=20)
                return resp.status_code < 500
            except requests.RequestException:
                return False

    info = xprocess.getinfo(Starter.name)
    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        _print_logs(info.logpath, Starter.name, "STARTED" if started else "FAILED")

    yield

    _print_logs(info.logpath, Starter.name, "TEARDOWN")
    info.terminate()


def test_typesense_grouped_search_api(start_app):
    """Secondary check: the server groups matches by brand with correct per-group totals."""
    resp = requests.get(
        f"{TYPESENSE_BASE_URL}/collections/products/documents/search",
        params={
            "q": "audio",
            "query_by": "name",
            "group_by": "brand",
            "group_limit": str(GROUP_LIMIT),
            "sort_by": "popularity:desc",
            "per_page": "50",
        },
        headers={"X-TYPESENSE-API-KEY": API_KEY},
        timeout=20,
    )
    assert resp.status_code == 200, (
        f"Grouped search request failed with status {resp.status_code}: {resp.text}"
    )
    body = resp.json()
    grouped = body.get("grouped_hits")
    assert isinstance(grouped, list), f"Expected 'grouped_hits' array in response, got: {body}"

    totals = {}
    for group in grouped:
        key = group.get("group_key")
        assert isinstance(key, list) and key, f"Malformed group_key in grouped hit: {group}"
        brand = key[0]
        assert "found" in group, (
            f"Each group must report its total matching count via 'found'; missing in: {group}"
        )
        totals[brand] = group["found"]
        hits = group.get("hits", [])
        assert len(hits) <= GROUP_LIMIT, (
            f"Group '{brand}' returned {len(hits)} hits but group_limit is {GROUP_LIMIT}."
        )

    assert totals == EXPECTED_GROUP_TOTALS, (
        f"Per-group total counts mismatch. Expected {EXPECTED_GROUP_TOTALS}, got {totals}."
    )
    assert body.get("found") == len(EXPECTED_GROUP_TOTALS), (
        f"Expected the number of brand groups to be {len(EXPECTED_GROUP_TOTALS)}, "
        f"got found={body.get('found')}."
    )


def test_grouped_results_first_page(start_app, browser_verifier):
    reason = (
        "The results page must present hits grouped by brand. Page 1 shows the first three "
        "brand groups in popularity-descending order, each displaying its correct total "
        "matching count while showing at most three items initially. Brands with more than "
        "three matches offer a 'Show more' control; brands with three or fewer do not. "
        "Expanding a brand reveals the rest of that brand's items."
    )
    truth = (
        f"Navigate to {APP_BASE_URL}/?q=audio . The page groups results by brand. "
        "Confirm exactly three brand groups are shown, in this order: 'Azura', then 'Boreas', "
        "then 'Cirrus'. "
        "For the 'Azura' group: it must display a total matching count of 5, and initially show "
        "exactly three products: 'Azura Audio Speaker Pro', 'Azura Audio Earbuds', and "
        "'Azura Audio Soundbar' (in that order). It must have a 'Show more' control. "
        "For the 'Boreas' group: it must display a total matching count of 2 and show exactly "
        "two products ('Boreas Audio Amplifier' and 'Boreas Audio Receiver'); it must NOT have a "
        "'Show more' control. "
        "For the 'Cirrus' group: it must display a total matching count of 3 and show exactly "
        "three products ('Cirrus Audio Turntable', 'Cirrus Audio Mixer', 'Cirrus Audio Monitor'); "
        "it must NOT have a 'Show more' control. "
        "Now click the 'Show more' control of the 'Azura' group. Confirm the 'Azura' group then "
        "shows five products, additionally revealing 'Azura Audio Headset' and 'Azura Audio Mic', "
        "with the full order being Speaker Pro, Earbuds, Soundbar, Headset, Mic."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_grouped_results_first_page",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


def test_group_level_pagination(start_app, browser_verifier):
    reason = (
        "The list of brand groups is paginated at the group level, at most three brand groups "
        "per page, with next/previous controls and a current page indicator. Page 2 shows the "
        "remaining brand groups, still with correct totals, per-group limits and 'Show more' "
        "behavior."
    )
    truth = (
        f"Navigate to {APP_BASE_URL}/?q=audio . Only three brand groups are visible on the first "
        "page ('Azura', 'Boreas', 'Cirrus'). Activate the next-page control to go to page 2. "
        "Confirm the page indicator now shows page 2, and exactly two brand groups are shown, in "
        "order: 'Denali' then 'Everest'. "
        "For the 'Denali' group: it must display a total matching count of 4 and initially show "
        "exactly three products ('Denali Audio Subwoofer', 'Denali Audio Tweeter', "
        "'Denali Audio Cable'); it must have a 'Show more' control. Click that 'Show more' control "
        "and confirm the 'Denali' group then shows four products, additionally revealing "
        "'Denali Audio Adapter'. "
        "For the 'Everest' group: it must display a total matching count of 6 and initially show "
        "exactly three products; it must have a 'Show more' control. "
        "Finally, activate the previous-page control and confirm the page indicator returns to "
        "page 1 showing 'Azura', 'Boreas', and 'Cirrus' again."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_group_level_pagination",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
