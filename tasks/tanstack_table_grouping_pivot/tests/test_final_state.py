import os
import re
import socket

import pytest
import requests
from xprocess import ProcessStarter
from playwright.sync_api import sync_playwright, expect

PROJECT_DIR = "/home/user/tanstack-grouping"
PORT = 5319
# Bind/connect over IPv4 explicitly. On Node 17+ `localhost` can resolve to the
# IPv6 loopback (::1), so a dev server may listen on ::1 only while an AF_INET
# socket to 127.0.0.1 never connects, causing confusing timeouts.
HOST = "127.0.0.1"
BASE_URL = f"http://{HOST}:{PORT}"

# Fixed dataset the app must render: (region, category, amount, units)
DATASET = [
    ("North", "Widgets", 1200, 40),
    ("North", "Gadgets", 800, 20),
    ("North", "Widgets", 600, 15),
    ("South", "Widgets", 1500, 50),
    ("South", "Gadgets", 400, 10),
    ("South", "Gadgets", 900, 30),
    ("East", "Widgets", 300, 10),
    ("East", "Gadgets", 1100, 25),
    ("North", "Gadgets", 700, 35),
    ("South", "Widgets", 700, 28),
    ("East", "Widgets", 2000, 80),
    ("East", "Gadgets", 600, 15),
]

GRAND_TOTAL = sum(r[2] for r in DATASET)  # 10800


def _group_stats(key_index):
    """Compute expected {group_value: (sum_amount, count, avg_unit_price)}."""
    groups = {}
    for region, category, amount, units in DATASET:
        key = region if key_index == 0 else category
        groups.setdefault(key, []).append((amount, units))
    stats = {}
    for key, rows in groups.items():
        total = sum(a for a, _ in rows)
        count = len(rows)
        avg_up = sum(a / u for a, u in rows) / count
        stats[key] = (total, count, avg_up)
    return stats


REGION_STATS = _group_stats(0)
CATEGORY_STATS = _group_stats(1)


def _num(text):
    """Extract the first numeric value (optional single decimal) from text."""
    assert text is not None, "Expected numeric text but element had no text."
    cleaned = text.replace(",", "").strip()
    m = re.search(r"-?\d+(?:\.\d+)?", cleaned)
    assert m is not None, f"Could not parse a number from text: {text!r}"
    return float(m.group(0))


@pytest.fixture(scope="session")
def start_app(xprocess):
    class Starter(ProcessStarter):
        name = "tanstack_grouping_app"
        # Force the dev server to bind the IPv4 loopback and the required port.
        args = ["npm", "run", "dev", "--", "--host", HOST, "--port", str(PORT)]
        env = os.environ.copy()
        popen_kwargs = {"cwd": PROJECT_DIR, "text": True}
        timeout = 240
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex((HOST, PORT)) != 0:
                    return False
            try:
                resp = requests.get(BASE_URL, timeout=20)
                return resp.status_code < 500
            except requests.RequestException:
                return False

    info = xprocess.getinfo(Starter.name)
    printed = 0

    def capture_logs(tag):
        nonlocal printed
        try:
            with open(info.logpath, "r") as f:
                lines = f.readlines()
        except FileNotFoundError:
            lines = []
        new = lines[printed:]
        printed = len(lines)
        print(f"===== [{tag}] {Starter.name} log begin =====")
        print("".join(new))
        print(f"===== [{tag}] {Starter.name} log end =====")

    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield
    capture_logs("TEARDOWN")
    info.terminate()


@pytest.fixture(scope="session")
def browser(start_app):
    with sync_playwright() as p:
        br = p.chromium.launch(headless=True)
        yield br
        br.close()


@pytest.fixture()
def page(browser):
    ctx = browser.new_context()
    pg = ctx.new_page()
    pg.goto(BASE_URL, wait_until="networkidle")
    # Ensure the core UI has mounted before each test.
    pg.wait_for_selector("[data-testid='group-by']", timeout=30000)
    pg.wait_for_selector("[data-testid='grand-total-amount']", timeout=30000)
    yield pg
    ctx.close()


def _read_group_rows(pg):
    """Return list of (group_value, sum, count, avg) in DOM order."""
    rows = pg.locator("[data-testid='group-row']")
    result = []
    for i in range(rows.count()):
        row = rows.nth(i)
        gv = row.get_attribute("data-group-value")
        s = _num(row.locator("[data-testid='group-sum-amount']").inner_text())
        c = _num(row.locator("[data-testid='group-count']").inner_text())
        a = _num(row.locator("[data-testid='group-avg-unit-price']").inner_text())
        result.append((gv, s, c, a))
    return result


def test_grand_total_on_load(page):
    val = _num(page.locator("[data-testid='grand-total-amount']").inner_text())
    assert val == GRAND_TOTAL, f"Grand total footer should be {GRAND_TOTAL}, got {val}."


def test_pinned_column_is_sticky(page):
    header = page.locator("[data-testid='pinned-col-header']")
    expect(header).to_have_count(1)
    position = header.evaluate("el => getComputedStyle(el).position")
    left = header.evaluate("el => getComputedStyle(el).left")
    assert position == "sticky", f"Pinned column header must have position:sticky, got {position!r}."
    assert left == "0px", f"Pinned column header must have left:0px, got {left!r}."


def test_group_by_region_aggregates(page):
    page.select_option("[data-testid='group-by']", "region")
    expect(page.locator("[data-testid='group-row']")).to_have_count(3)

    rows = _read_group_rows(page)
    seen = {gv for gv, *_ in rows}
    assert seen == set(REGION_STATS.keys()), (
        f"Region groups should be {set(REGION_STATS.keys())}, got {seen}."
    )
    for gv, s, c, a in rows:
        exp_sum, exp_count, exp_avg = REGION_STATS[gv]
        assert s == exp_sum, f"Group {gv} sum should be {exp_sum}, got {s}."
        assert c == exp_count, f"Group {gv} count should be {exp_count}, got {c}."
        assert abs(a - exp_avg) <= 0.01, (
            f"Group {gv} avg unit price should be ~{exp_avg:.4f}, got {a}."
        )

    # Invariant: expand every group, then each group's displayed sum must equal
    # the sum of its now-visible per-row amount cells.
    toggles = page.locator("[data-testid='group-row'] [data-testid='group-toggle']")
    for i in range(toggles.count()):
        toggles.nth(i).click()
    for gv in REGION_STATS:
        cells = page.locator(
            f"[data-testid='data-row'][data-group-value='{gv}'] [data-testid='cell-amount']:visible"
        )
        expect(cells).to_have_count(REGION_STATS[gv][1])
        total = sum(_num(cells.nth(i).inner_text()) for i in range(cells.count()))
        assert total == REGION_STATS[gv][0], (
            f"Sum of visible row amounts for {gv} ({total}) must equal the group "
            f"aggregate sum ({REGION_STATS[gv][0]})."
        )


def test_groups_collapsed_by_default(page):
    page.select_option("[data-testid='group-by']", "region")
    expect(page.locator("[data-testid='group-row']")).to_have_count(3)
    visible_rows = page.locator("[data-testid='data-row']:visible")
    expect(visible_rows).to_have_count(0)


def test_expand_and_collapse_group(page):
    page.select_option("[data-testid='group-by']", "region")
    expect(page.locator("[data-testid='group-row']")).to_have_count(3)

    north_toggle = page.locator(
        "[data-testid='group-row'][data-group-value='North'] [data-testid='group-toggle']"
    )
    north_rows = page.locator(
        "[data-testid='data-row'][data-group-value='North']:visible"
    )

    expect(north_rows).to_have_count(0)
    north_toggle.click()
    expect(north_rows).to_have_count(REGION_STATS["North"][1])  # 4
    north_toggle.click()
    expect(north_rows).to_have_count(0)


def test_switch_grouping_column(page):
    page.select_option("[data-testid='group-by']", "category")
    expect(page.locator("[data-testid='group-row']")).to_have_count(2)

    rows = _read_group_rows(page)
    seen = {gv for gv, *_ in rows}
    assert seen == set(CATEGORY_STATS.keys()), (
        f"Category groups should be {set(CATEGORY_STATS.keys())}, got {seen}."
    )
    assert "North" not in seen and "South" not in seen and "East" not in seen, (
        "Region group values must not remain after switching to category grouping."
    )
    for gv, s, c, a in rows:
        exp_sum, exp_count, _ = CATEGORY_STATS[gv]
        assert s == exp_sum, f"Group {gv} sum should be {exp_sum}, got {s}."
        assert c == exp_count, f"Group {gv} count should be {exp_count}, got {c}."

    grand = _num(page.locator("[data-testid='grand-total-amount']").inner_text())
    assert grand == GRAND_TOTAL, (
        f"Grand total must remain {GRAND_TOTAL} after switching grouping, got {grand}."
    )


def test_sort_groups_by_aggregate(page):
    page.select_option("[data-testid='group-by']", "region")
    expect(page.locator("[data-testid='group-row']")).to_have_count(3)

    expected_desc = [gv for gv, _ in sorted(
        ((k, v[0]) for k, v in REGION_STATS.items()), key=lambda x: -x[1]
    )]  # East(4000), South(3500), North(3300)
    expected_asc = list(reversed(expected_desc))

    page.select_option("[data-testid='sort-groups']", "desc")
    expect(page.locator("[data-testid='group-row']")).to_have_count(3)
    order_desc = [gv for gv, *_ in _read_group_rows(page)]
    assert order_desc == expected_desc, (
        f"Descending group order should be {expected_desc}, got {order_desc}."
    )

    page.select_option("[data-testid='sort-groups']", "asc")
    expect(page.locator("[data-testid='group-row']")).to_have_count(3)
    order_asc = [gv for gv, *_ in _read_group_rows(page)]
    assert order_asc == expected_asc, (
        f"Ascending group order should be {expected_asc}, got {order_asc}."
    )
