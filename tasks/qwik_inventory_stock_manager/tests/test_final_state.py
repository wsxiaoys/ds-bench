import html as html_lib
import os
import re
import socket
import sqlite3
import concurrent.futures
from urllib.parse import urljoin

import pytest
import requests
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/inventory-app"
DB_PATH = "/home/user/inventory-app/data/inventory.db"
PORT = 5173
# Bind/connect over IPv4 explicitly. On Node 17+ `localhost` can resolve to the
# IPv6 loopback (::1), so the dev server may listen on ::1 only while an AF_INET
# socket to 127.0.0.1 never connects.
HOST = "127.0.0.1"
BASE_URL = f"http://{HOST}:{PORT}"


# --------------------------------------------------------------------------- #
# Service fixture
# --------------------------------------------------------------------------- #
@pytest.fixture(scope="session", autouse=True)
def start_app(xprocess):
    class Starter(ProcessStarter):
        name = "inventory_app"
        args = ["npm", "run", "dev", "--", "--host", HOST, "--port", str(PORT)]
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 240
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex((HOST, PORT)) != 0:
                    return False
            try:
                resp = requests.get(BASE_URL, timeout=30)
                return resp.status_code < 500
            except requests.RequestException:
                return False

    info = xprocess.getinfo(Starter.name)
    printed_log_lines = 0

    def capture_logs(tag):
        nonlocal printed_log_lines
        try:
            with open(info.logpath, "r") as f:
                all_lines = f.readlines()
        except OSError:
            return
        new_lines = all_lines[printed_log_lines:]
        printed_log_lines = len(all_lines)
        print(f"===== [{tag}] {Starter.name} log (begin) =====")
        print("".join(new_lines))
        print(f"===== [{tag}] {Starter.name} log (end) =====")

    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield

    capture_logs("TEARDOWN")
    info.terminate()


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def get_page():
    resp = requests.get(BASE_URL, timeout=30)
    assert resp.status_code == 200, f"GET / returned {resp.status_code}"
    return resp.text


def get_action_url(page_html=None):
    """Read the Qwik City action URL from the movement form's `action` attribute."""
    if page_html is None:
        page_html = get_page()
    form_tag = re.search(
        r'<form\b[^>]*data-testid=["\']movement-form["\'][^>]*>',
        page_html,
        re.IGNORECASE,
    )
    assert form_tag, 'Could not find a <form> with data-testid="movement-form".'
    action_match = re.search(
        r'action=["\']([^"\']+)["\']', form_tag.group(0), re.IGNORECASE
    )
    assert action_match, "movement-form does not have an action attribute."
    action = html_lib.unescape(action_match.group(1))
    return urljoin(BASE_URL, action)


def submit_movement(product_id, mtype, quantity, action_url=None):
    if action_url is None:
        action_url = get_action_url()
    return requests.post(
        action_url,
        data={"productId": str(product_id), "type": mtype, "quantity": str(quantity)},
        timeout=30,
    )


def get_qty(product_id, page_html=None):
    if page_html is None:
        page_html = get_page()
    m = re.search(
        rf'data-testid=["\']qty-{product_id}["\'][^>]*>\s*(-?\d+)',
        page_html,
        re.IGNORECASE,
    )
    assert m, f"Could not find quantity element data-testid=\"qty-{product_id}\"."
    return int(m.group(1))


def db_ro():
    return sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True, timeout=30)


def sum_delta(product_id):
    conn = db_ro()
    try:
        row = conn.execute(
            "SELECT COALESCE(SUM(delta), 0) FROM stock_movements WHERE product_id=?",
            (product_id,),
        ).fetchone()
    finally:
        conn.close()
    return row[0]


def count_movements(product_id, delta=None):
    conn = db_ro()
    try:
        if delta is None:
            row = conn.execute(
                "SELECT COUNT(*) FROM stock_movements WHERE product_id=?",
                (product_id,),
            ).fetchone()
        else:
            row = conn.execute(
                "SELECT COUNT(*) FROM stock_movements WHERE product_id=? AND delta=?",
                (product_id, delta),
            ).fetchone()
    finally:
        conn.close()
    return row[0]


# --------------------------------------------------------------------------- #
# Tests (executed in definition order; state accumulates across tests)
# --------------------------------------------------------------------------- #
def test_initial_render():
    page = get_page()
    assert get_qty(1, page) == 100, "Initial on-hand quantity for product 1 should be 100."
    assert get_qty(2, page) == 50, "Initial on-hand quantity for product 2 should be 50."
    assert get_qty(3, page) == 10, "Initial on-hand quantity for product 3 should be 10."
    assert get_qty(4, page) == 60, "Initial on-hand quantity for product 4 should be 60."
    assert re.search(r'data-testid=["\']product-1["\']', page), \
        'Missing element data-testid="product-1".'
    assert "WIDGET-A" in page, "Product 1 SKU WIDGET-A is not rendered on the page."
    assert get_action_url(page), "The movement form action URL could not be resolved."


def test_valid_receive():
    resp = submit_movement(2, "receive", 25)
    assert resp.status_code < 400, f"Valid receive returned HTTP {resp.status_code}."
    assert get_qty(2) == 75, "Product 2 quantity should be 75 after receiving 25 units."
    assert count_movements(2, 25) >= 1, "Expected a ledger row with delta=+25 for product 2."


def test_valid_ship():
    resp = submit_movement(1, "ship", 30)
    assert resp.status_code < 400, f"Valid ship returned HTTP {resp.status_code}."
    assert get_qty(1) == 70, "Product 1 quantity should be 70 after shipping 30 units."
    assert count_movements(1, -30) >= 1, "Expected a ledger row with delta=-30 for product 1."


def test_overship_rejected_atomically():
    before = count_movements(3)
    resp = submit_movement(3, "ship", 1000)
    # The submission is rejected; the re-rendered page must surface an error.
    error_shown = 'data-testid="error"' in resp.text or 'data-testid="error"' in get_page()
    assert error_shown, "Over-shipping should display data-testid=\"error\"."
    assert get_qty(3) == 10, "Product 3 quantity must stay at 10 after a rejected over-ship."
    assert count_movements(3) == before, \
        "A rejected over-ship must not insert any stock_movements row for product 3."


def test_invalid_product_rejected():
    resp = submit_movement(999, "ship", 5)
    error_shown = 'data-testid="error"' in resp.text or 'data-testid="error"' in get_page()
    assert error_shown, "Submitting a non-existent product should display data-testid=\"error\"."
    assert count_movements(999) == 0, \
        "No stock_movements row should exist for the non-existent product 999."


def test_nonpositive_quantity_rejected():
    before = count_movements(1)
    resp = submit_movement(1, "receive", 0)
    error_shown = 'data-testid="error"' in resp.text or 'data-testid="error"' in get_page()
    assert error_shown, "A non-positive quantity should display data-testid=\"error\"."
    assert count_movements(1) == before, \
        "A rejected non-positive submission must not insert any ledger row for product 1."


def test_ledger_is_source_of_truth():
    conn = db_ro()
    try:
        product_ids = [r[0] for r in conn.execute("SELECT id FROM products").fetchall()]
    finally:
        conn.close()
    page = get_page()
    for pid in product_ids:
        displayed = get_qty(pid, page)
        computed = sum_delta(pid)
        assert displayed == computed, (
            f"Displayed quantity for product {pid} ({displayed}) must equal "
            f"SUM(delta) from the ledger ({computed})."
        )


def test_concurrency_no_overselling():
    # Product 4 starts at 60 on hand. 20 concurrent ships of 10 => exactly 6 succeed.
    action_url = get_action_url()
    ship_rows_before = count_movements(4, -10)

    def do_ship(_):
        try:
            r = submit_movement(4, "ship", 10, action_url=action_url)
            return r.status_code
        except requests.RequestException:
            return None

    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as pool:
        list(pool.map(do_ship, range(20)))

    new_ship_rows = count_movements(4, -10) - ship_rows_before
    assert new_ship_rows == 6, (
        f"Exactly 6 concurrent ships of 10 should succeed against 60 units, "
        f"but {new_ship_rows} ledger rows were added."
    )
    assert sum_delta(4) == 0, "Product 4 on-hand stock computed from the ledger must be 0."
    final_qty = get_qty(4)
    assert final_qty == 0, f"Product 4 displayed quantity must be 0, got {final_qty}."
    assert final_qty >= 0, "Product 4 on-hand stock must never go negative."
