import os
import re
import socket

import pytest
import requests
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/faceted-search"
PORT = 47615
# Connect over IPv4 explicitly. On Node 17+ `localhost` may resolve to the IPv6
# loopback (::1) while the dev server binds 127.0.0.1, which would make the
# readiness check hang for the full timeout.
HOST = "127.0.0.1"
BASE_URL = f"http://{HOST}:{PORT}"


def _extract_first_int_after(html, marker):
    """Return the first integer appearing at/after the given marker substring."""
    idx = html.find(marker)
    if idx == -1:
        return None
    segment = html[idx : idx + 300]
    m = re.search(r">\s*([0-9]+)", segment)
    if m:
        return int(m.group(1))
    m = re.search(r"([0-9]+)", segment[len(marker):])
    return int(m.group(1)) if m else None


@pytest.fixture(scope="session")
def browser_verifier():
    return PochiVerifier()


@pytest.fixture(scope="session")
def start_app(xprocess):
    class Starter(ProcessStarter):
        name = "faceted_search_app"
        args = ["npm", "run", "dev"]
        # CRITICAL: set `env` as a class attribute, never inside popen_kwargs.
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 300
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex((HOST, PORT)) != 0:
                    return False
            try:
                resp = requests.get(BASE_URL + "/", timeout=60)
                return resp.status_code < 500
            except requests.RequestException:
                return False

    info = xprocess.getinfo(Starter.name)
    printed = 0

    def capture_logs(tag):
        nonlocal printed
        try:
            with open(info.logpath, "r") as f:
                all_lines = f.readlines()
        except OSError:
            return
        new_lines = all_lines[printed:]
        printed = len(all_lines)
        print(f"===== [{tag}: Begin] {Starter.name} log =====")
        print("".join(new_lines))
        print(f"===== [{tag}: End] {Starter.name} log =====")

    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield

    capture_logs("TEARDOWN")
    info.terminate()


def test_base_listing_defaults(start_app):
    """Cold-load the index: 20 total products, exactly 6 cards on page 1, page 1."""
    resp = requests.get(BASE_URL + "/", timeout=60)
    assert resp.status_code == 200, f"Base page returned {resp.status_code}."
    html = resp.text
    total = _extract_first_int_after(html, 'data-testid="results-total"')
    assert total == 20, f"Expected results-total 20 on default listing, got {total}."
    card_count = html.count('data-testid="product-card"')
    assert card_count == 6, f"Expected exactly 6 product-card elements on page 1, got {card_count}."


def test_deep_link_combined_filters_sorted_ssr(start_app):
    """Deep-link with combined filters must render the correct filtered+sorted
    results server-side on first load (no JS)."""
    params = {
        "q": "",
        "categories": '["electronics","toys"]',
        "minPrice": "50",
        "maxPrice": "200",
        "inStock": "true",
        "sort": "price_asc",
        "page": "1",
    }
    resp = requests.get(BASE_URL + "/", params=params, timeout=60)
    assert resp.status_code == 200, f"Deep-link page returned {resp.status_code}."
    html = resp.text

    expected_order = [
        "Galactic Building Blocks",
        "RC Rally Truck",
        "Volt Mechanical Keyboard",
        "Aurora Wireless Headphones",
    ]
    positions = []
    for name in expected_order:
        pos = html.find(name)
        assert pos != -1, f"Expected product '{name}' to be server-rendered on the deep-link page."
        positions.append(pos)
    assert positions == sorted(positions), (
        f"Products must be sorted by price ascending; expected order {expected_order}, "
        f"got HTML positions {positions}."
    )

    total = _extract_first_int_after(html, 'data-testid="results-total"')
    assert total == 4, f"Expected results-total 4 for the combined deep-link filter, got {total}."


def test_server_side_filtering_excludes_nonmatching(start_app):
    """Anti-cheat: the non-matching, higher-priced product must NOT be sent to the
    client, proving the loader filters server-side rather than shipping the full catalog."""
    params = {
        "q": "",
        "categories": '["electronics","toys"]',
        "minPrice": "50",
        "maxPrice": "200",
        "inStock": "true",
        "sort": "price_asc",
        "page": "1",
    }
    html = requests.get(BASE_URL + "/", params=params, timeout=60).text
    assert "Galactic Building Blocks" in html, "Matching product missing from server-rendered HTML."
    assert "Photon 4K Monitor" not in html, (
        "Non-matching product 'Photon 4K Monitor' (price > 200) appeared in the HTML; "
        "filtering must happen server-side in the loader, not on the client."
    )


def test_facet_counts_exclude_category_selection(start_app):
    """Facet counts must respect price + in-stock filters but ignore the active
    category selection."""
    params = {
        "q": "",
        "categories": '["electronics","toys"]',
        "minPrice": "50",
        "maxPrice": "200",
        "inStock": "true",
        "sort": "price_asc",
        "page": "1",
    }
    html = requests.get(BASE_URL + "/", params=params, timeout=60).text
    expected = {
        "electronics": 2,
        "toys": 2,
        "clothing": 1,
        "books": 0,
        "home": 0,
    }
    for slug, want in expected.items():
        got = _extract_first_int_after(html, f'data-testid="facet-count-{slug}"')
        assert got == want, (
            f"Facet count for '{slug}' expected {want} (price 50-200, in-stock, ignoring "
            f"category selection), got {got}."
        )


def test_server_side_pagination(start_app):
    """Page 2 of the default (name_asc) listing must render the second page of
    products server-side."""
    resp = requests.get(BASE_URL + "/", params={"page": "2"}, timeout=60)
    assert resp.status_code == 200, f"Page 2 returned {resp.status_code}."
    html = resp.text
    assert "Galactic Building Blocks" in html, "Expected 'Galactic Building Blocks' on page 2."
    assert "Aurora Wireless Headphones" not in html, (
        "'Aurora Wireless Headphones' belongs to page 1 and must not appear on page 2."
    )
    page_current = _extract_first_int_after(html, 'data-testid="page-current"')
    assert page_current == 2, f"Expected page-current to be 2, got {page_current}."


def test_malformed_params_coerced_to_defaults(start_app):
    """Invalid/malformed search params must be coerced to defaults and render 200."""
    params = {
        "q": "",
        "categories": "notacategory",
        "minPrice": "-5",
        "maxPrice": "notanumber",
        "inStock": "maybe",
        "sort": "bogus",
        "page": "abc",
    }
    resp = requests.get(BASE_URL + "/", params=params, timeout=60)
    assert resp.status_code == 200, (
        f"Malformed params must be coerced and render HTTP 200, got {resp.status_code}."
    )
    html = resp.text
    total = _extract_first_int_after(html, 'data-testid="results-total"')
    assert total == 20, f"Malformed params must fall back to the full catalog (20), got {total}."
    assert "Aurora Wireless Headphones" in html, (
        "Default listing (name_asc, page 1) should render its first product."
    )
    page_current = _extract_first_int_after(html, 'data-testid="page-current"')
    assert page_current == 1, f"Malformed page value must fall back to page 1, got {page_current}."


def test_facets_url_and_back_navigation(start_app, browser_verifier):
    """Real headless-browser check: applying facets updates the URL and the visible
    results, and browser Back restores the prior filter state."""
    reason = (
        "This is a URL-driven faceted product search. Every filter lives in the URL search "
        "params, changing a filter updates both the URL and the visible results, and browser "
        "back/forward restores prior filter states."
    )
    truth = (
        f"Navigate to {BASE_URL}/ and wait for products to load. "
        "Confirm the element with data-testid 'results-total' shows the number 20. "
        "Then click the control with data-testid 'facet-category-electronics'. "
        "After it updates, confirm ALL of the following: the browser address bar URL now contains "
        "the text 'electronics'; the element with data-testid 'results-total' now shows the number 5; "
        "a product card with the name 'Volt Mechanical Keyboard' is visible; and NO product card with "
        "the name 'The Quantum Garden' is visible. "
        "Then click the control with data-testid 'filter-instock' to enable the in-stock filter. "
        "After it updates, confirm ALL of the following: the element with data-testid 'results-total' "
        "now shows the number 3; a product card named 'Aurora Wireless Headphones' is visible; and NO "
        "product card named 'Nimbus Bluetooth Speaker' is visible. "
        "Then use the browser's Back button exactly once. After navigating back, confirm the previous "
        "state is restored: the element with data-testid 'results-total' shows the number 5 again, and "
        "a product card named 'Nimbus Bluetooth Speaker' is visible again. "
        "Report pass ONLY if every one of these conditions holds; otherwise report fail."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_facets_url_and_back_navigation",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
