import os
import re
import socket
import time

import pytest
import requests
from xprocess import ProcessStarter

from playwright.sync_api import sync_playwright

PROJECT_DIR = "/home/user/auction"
PORT = 5173
# Bind/connect over IPv4 explicitly. On Node 17+ `localhost` can resolve to the
# IPv6 loopback (::1); forcing 127.0.0.1 keeps the readiness check, the browser,
# and the dev server on the same address.
HOST = "127.0.0.1"
BASE_URL = f"http://{HOST}:{PORT}"

ITEM = "lot-42"
ITEM_URL = f"{BASE_URL}/auction/{ITEM}"
ITEM_NAME = "Sunburst Electric Guitar"
START_PRICE = 50

ALICE = "Alice"
BOB = "Bob"
CAROL = "Carol"


# --------------------------------------------------------------------------- #
# Server lifecycle
# --------------------------------------------------------------------------- #
@pytest.fixture(scope="session")
def start_app(xprocess):
    class Starter(ProcessStarter):
        name = "auction_app"
        # Force Vite to bind the IPv4 loopback and the expected port.
        args = ["npm", "run", "dev", "--", "--host", HOST, "--port", str(PORT)]
        # CRITICAL: env is a class attribute here, never inside popen_kwargs.
        env = {**os.environ, "NODE_ENV": "development"}
        popen_kwargs = {"cwd": PROJECT_DIR, "text": True}
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
    printed = 0

    def capture_logs(tag):
        nonlocal printed
        try:
            with open(info.logpath, "r") as f:
                lines = f.readlines()
        except OSError:
            return
        new = lines[printed:]
        printed = len(lines)
        print(f"===== [{tag}] {Starter.name} log =====")
        print("".join(new))
        print(f"===== [{tag}] end log =====")

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
        b = p.chromium.launch(headless=True, args=["--no-sandbox"])
        yield b
        b.close()


@pytest.fixture(scope="session")
def warmed(browser):
    """Warm dev-server route + client-bundle compilation on a throwaway item id
    so that opening lot-42 later is fast and its 25s countdown is not consumed by
    first-time Vite compilation."""
    ctx = browser.new_context()
    page = ctx.new_page()
    try:
        page.goto(f"{BASE_URL}/auction/zt-warmup?name=Warm", wait_until="load", timeout=120000)
        # Best-effort: wait for the countdown control (proves the client hydrated).
        try:
            page.wait_for_selector('[data-testid="time-left"]', timeout=60000)
            page.wait_for_timeout(1500)
        except Exception:
            pass
    except Exception:
        pass
    finally:
        ctx.close()
    yield


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _digits(text):
    if text is None:
        return None
    d = re.sub(r"[^0-9]", "", text)
    return int(d) if d != "" else None


def read_int(page, testid):
    el = page.query_selector(f'[data-testid="{testid}"]')
    if el is None:
        return None
    return _digits(el.text_content())


def read_text(page, testid):
    el = page.query_selector(f'[data-testid="{testid}"]')
    return (el.text_content() or "").strip() if el is not None else None


def wait_digits_equal(page, testid, value, msg, timeout=20000):
    js = (
        "() => { var el = document.querySelector('[data-testid=\"" + testid + "\"]');"
        " if(!el) return false;"
        " var d = (el.textContent||'').replace(/[^0-9]/g,'');"
        " return d === '" + str(value) + "'; }"
    )
    try:
        page.wait_for_function(js, timeout=timeout)
    except Exception:
        pytest.fail(msg + f" (got '{read_text(page, testid)}')")


def wait_text_equal(page, testid, text, msg, timeout=20000):
    js = (
        "() => { var el = document.querySelector('[data-testid=\"" + testid + "\"]');"
        " return !!el && (el.textContent||'').trim() === '" + text + "'; }"
    )
    try:
        page.wait_for_function(js, timeout=timeout)
    except Exception:
        pytest.fail(msg + f" (got '{read_text(page, testid)}')")


def wait_winner(page, name, amount, msg, timeout=20000):
    js = (
        "() => { var el = document.querySelector('[data-testid=\"winner\"]');"
        " if(!el) return false; var t = el.textContent||'';"
        " return t.indexOf('" + name + "') !== -1"
        " && (t.replace(/[^0-9]/g,'')).indexOf('" + str(amount) + "') !== -1; }"
    )
    try:
        page.wait_for_function(js, timeout=timeout)
    except Exception:
        pytest.fail(msg + f" (got '{read_text(page, 'winner')}')")


def wait_place_bid_disabled(page, msg, timeout=20000):
    js = (
        "() => { var el = document.querySelector('[data-testid=\"place-bid\"]');"
        " return !!el && el.disabled === true; }"
    )
    try:
        page.wait_for_function(js, timeout=timeout)
    except Exception:
        pytest.fail(msg)


def wait_for_close(page, timeout=45000):
    js = (
        "() => { var el = document.querySelector('[data-testid=\"time-left\"]');"
        " if(!el) return true;"
        " var d = (el.textContent||'').replace(/[^0-9]/g,'');"
        " return d !== '' && parseInt(d,10) <= 0; }"
    )
    page.wait_for_function(js, timeout=timeout)


def place_bid(page, amount):
    page.fill('[data-testid="bid-input"]', str(amount))
    page.click('[data-testid="place-bid"]')


# --------------------------------------------------------------------------- #
# The single live-session test (the auction can only be run to close once).
# --------------------------------------------------------------------------- #
def test_live_auction_full_flow(browser, warmed):
    ctx_a = browser.new_context()
    ctx_b = browser.new_context()
    page_a = ctx_a.new_page()
    page_b = ctx_b.new_page()

    try:
        # --- Step 1: initial render for Alice ---------------------------------
        page_a.goto(f"{ITEM_URL}?name={ALICE}", wait_until="load", timeout=90000)
        page_a.wait_for_selector('[data-testid="time-left"]', timeout=60000)

        wait_text_equal(page_a, "item-name", ITEM_NAME,
                        f"item-name should read '{ITEM_NAME}' for Alice")
        wait_text_equal(page_a, "my-name", ALICE,
                        "my-name should read 'Alice' for context A")
        wait_digits_equal(page_a, "current-bid", START_PRICE,
                          "current-bid should start at the starting price 50")

        t1 = read_int(page_a, "time-left")
        assert t1 is not None and t1 > 8, (
            f"time-left should start as a positive integer well above 8, got {t1}"
        )
        page_a.wait_for_timeout(2000)
        t2 = read_int(page_a, "time-left")
        assert t2 is not None and t2 < t1, (
            f"time-left should be counting down (t1={t1}, t2={t2})"
        )

        # --- Step 2: second client Bob ---------------------------------------
        page_b.goto(f"{ITEM_URL}?name={BOB}", wait_until="load", timeout=90000)
        page_b.wait_for_selector('[data-testid="time-left"]', timeout=60000)
        wait_text_equal(page_b, "item-name", ITEM_NAME,
                        f"item-name should read '{ITEM_NAME}' for Bob")
        wait_text_equal(page_b, "my-name", BOB,
                        "my-name should read 'Bob' for context B")
        wait_digits_equal(page_b, "current-bid", START_PRICE,
                          "current-bid should read 50 for Bob before any bids")

        # --- Step 3: Alice bids 100, Bob must see it live (no reload) ----------
        place_bid(page_a, 100)
        wait_digits_equal(page_b, "current-bid", 100,
                          "Bob's current-bid should update to 100 after Alice bids (real-time)")
        wait_text_equal(page_b, "high-bidder", ALICE,
                        "Bob's high-bidder should become 'Alice' after Alice's bid")
        wait_digits_equal(page_a, "current-bid", 100,
                          "Alice's current-bid should be 100 after her own bid")
        wait_text_equal(page_a, "high-bidder", ALICE,
                        "Alice's high-bidder should be 'Alice'")

        # --- Step 4: Bob bids 90 -> rejected, no state change -----------------
        place_bid(page_b, 90)
        try:
            page_b.wait_for_selector('[data-testid="bid-error"]', state="visible", timeout=15000)
        except Exception:
            pytest.fail("bid-error should become visible after Bob's invalid bid of 90")

        # State must be unchanged in BOTH contexts.
        wait_digits_equal(page_b, "current-bid", 100,
                          "current-bid must stay 100 after the rejected bid (context B)")
        wait_text_equal(page_b, "high-bidder", ALICE,
                        "high-bidder must stay 'Alice' after the rejected bid (context B)")
        assert read_int(page_a, "current-bid") == 100, (
            "current-bid must stay 100 in context A after Bob's rejected bid"
        )
        assert read_text(page_a, "high-bidder") == ALICE, (
            "high-bidder must stay 'Alice' in context A after Bob's rejected bid"
        )

        # --- Step 5: Bob bids 150 -> accepted, both update --------------------
        place_bid(page_b, 150)
        wait_digits_equal(page_a, "current-bid", 150,
                          "Alice's current-bid should update to 150 after Bob's valid bid (real-time)")
        wait_text_equal(page_a, "high-bidder", BOB,
                        "Alice's high-bidder should become 'Bob' after Bob's 150 bid")
        wait_digits_equal(page_b, "current-bid", 150,
                          "Bob's current-bid should be 150 after his own valid bid")
        wait_text_equal(page_b, "high-bidder", BOB,
                        "Bob's high-bidder should be 'Bob'")

        # --- Step 6: auto-close, no interaction -------------------------------
        wait_for_close(page_a, timeout=45000)

        wait_winner(page_a, BOB, 150,
                    "After close, context A's winner banner must name Bob and amount 150")
        wait_winner(page_b, BOB, 150,
                    "After close, context B's winner banner must name Bob and amount 150")
        wait_place_bid_disabled(page_a, "place-bid must be disabled after close (context A)")
        wait_place_bid_disabled(page_b, "place-bid must be disabled after close (context B)")

        # --- Step 7: persistence in a brand-new session -----------------------
        ctx_c = browser.new_context()
        page_c = ctx_c.new_page()
        try:
            page_c.goto(f"{ITEM_URL}?name={CAROL}", wait_until="load", timeout=90000)
            wait_winner(page_c, BOB, 150,
                        "A fresh session loading the closed auction must show winner Bob / 150 (persisted)")
            wait_place_bid_disabled(page_c, "place-bid must remain disabled for a fresh session after close")
        finally:
            ctx_c.close()

    finally:
        ctx_a.close()
        ctx_b.close()
