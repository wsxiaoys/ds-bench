import os
import re
import socket
import subprocess

import pytest
import requests
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/qwik-context-di"
SRC_DIR = os.path.join(PROJECT_DIR, "src")
PORT = 3000
# Bind/connect over IPv4 explicitly. On Node 17+ `localhost` can resolve to the
# IPv6 loopback (::1), which would make the readiness check hang.
HOST = "127.0.0.1"
BASE_URL = f"http://{HOST}:{PORT}"


# ---------------------------------------------------------------------------
# Static checks: the shared state must be wired through Qwik's context API
# (createContextId / useContextProvider / useContext) and aggregated with
# useComputed$ -- prop drilling is not allowed.
# ---------------------------------------------------------------------------
def _iter_source_files():
    for root, _dirs, files in os.walk(SRC_DIR):
        for name in files:
            if name.endswith((".ts", ".tsx")):
                yield os.path.join(root, name)


def _read(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def test_context_id_created():
    combined = "\n".join(_read(p) for p in _iter_source_files())
    assert "createContextId" in combined, (
        "No use of createContextId found in src/; contexts must be created with the Qwik context API."
    )


def test_layout_provides_contexts():
    layout = os.path.join(SRC_DIR, "routes", "layout.tsx")
    assert os.path.isfile(layout), (
        "src/routes/layout.tsx not found; contexts must be provided at the root route layout."
    )
    content = _read(layout)
    provider_count = len(re.findall(r"useContextProvider\s*\(", content))
    assert provider_count >= 2, (
        "src/routes/layout.tsx must call useContextProvider for both the theme and the cart "
        f"contexts (found {provider_count} calls)."
    )


def test_useComputed_used_for_aggregates():
    combined = "\n".join(_read(p) for p in _iter_source_files())
    assert "useComputed$" in combined, (
        "No use of useComputed$ found in src/; cart aggregates must be derived with useComputed$."
    )


def test_context_consumed_deeply_not_prop_drilled():
    consumers = []
    for path in _iter_source_files():
        if os.path.basename(path) == "layout.tsx":
            continue
        if re.search(r"useContext\s*\(", _read(path)):
            consumers.append(path)
    assert consumers, (
        "No component outside the layout consumes state via useContext(); state must be injected "
        "through context, not passed down as props."
    )


# ---------------------------------------------------------------------------
# Long-running SSR server fixture: build then serve on port 3000.
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def start_app(xprocess):
    build = subprocess.run(
        ["npm", "run", "build"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
    )
    print("============================== [BUILD stdout] ==============================")
    print(build.stdout)
    print("============================== [BUILD stderr] ==============================")
    print(build.stderr)
    assert build.returncode == 0, f"'npm run build' failed with code {build.returncode}."

    serve_env = os.environ.copy()
    serve_env["PORT"] = str(PORT)
    serve_env["HOST"] = HOST
    serve_env["ORIGIN"] = BASE_URL

    class Starter(ProcessStarter):
        name = "qwik_ssr"
        args = ["npm", "run", "serve"]
        env = serve_env
        popen_kwargs = {"cwd": PROJECT_DIR, "text": True}
        timeout = 180
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
        except OSError:
            lines = []
        new = lines[printed:]
        printed = len(lines)
        print(f"===================== [{tag}] {Starter.name} log =====================")
        print("".join(new))
        print(f"===================== [{tag}] end =====================")

    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield BASE_URL

    capture_logs("TEARDOWN")
    info.terminate()


@pytest.fixture(scope="session")
def browser_verifier():
    return PochiVerifier()


# ---------------------------------------------------------------------------
# Server-side rendering: the raw HTML (no client JS executed) must already
# contain the deep tree rendered from the injected context, and must carry the
# Qwik resumability container so the client can resume.
# ---------------------------------------------------------------------------
def _strip_html_comments(html):
    # Qwik injects `<!--t=..-->`/`<!---->` markers around fine-grained dynamic
    # text nodes; strip them so text/value assertions match the visible content.
    return re.sub(r"<!--.*?-->", "", html, flags=re.DOTALL)


def test_ssr_raw_html_contains_context_state(start_app):
    resp = requests.get(BASE_URL, timeout=30)
    assert resp.status_code == 200, f"GET / returned {resp.status_code}."
    html = _strip_html_comments(resp.text)

    assert "Theme: light" in html, "SSR HTML does not contain 'Theme: light'."
    assert "Keyboard" in html, "SSR HTML does not contain the item name 'Keyboard'."
    assert "Mouse" in html, "SSR HTML does not contain the item name 'Mouse'."
    assert "$89.97" in html, "SSR HTML does not contain the initial cart total '$89.97'."

    assert 'data-testid="app-root"' in html, (
        "SSR HTML does not contain the app-root container."
    )
    assert 'data-theme="light"' in html, (
        "SSR HTML does not expose data-theme=\"light\" on the app container."
    )
    assert re.search(r'data-testid="cart-count">\s*3\s*<', html), (
        "SSR HTML does not render cart-count as '3'."
    )
    assert re.search(r'data-testid="cart-total">\s*\$89\.97\s*<', html), (
        "SSR HTML does not render cart-total as '$89.97'."
    )


def test_ssr_html_is_resumable(start_app):
    resp = requests.get(BASE_URL, timeout=30)
    assert resp.status_code == 200, f"GET / returned {resp.status_code}."
    assert "q:container" in resp.text, (
        "SSR HTML has no Qwik 'q:container' marker; the page is not a resumable Qwik render."
    )


# ---------------------------------------------------------------------------
# Client resume + fine-grained reactivity: drive the live page in a browser and
# assert the deep context-bound nodes update correctly through the sequence.
# ---------------------------------------------------------------------------
def test_client_resume_and_reactivity(start_app, browser_verifier):
    reason = (
        "A Qwik storefront injects a theme and a cart store through the context API and consumes "
        "them in a deeply nested tree. After the client resumes, interacting with deeply nested "
        "controls must mutate the injected store and the theme, and the fine-grained bound nodes "
        "(item quantities, the useComputed$ aggregates, and every theme consumer) must update "
        "consistently."
    )
    truth = (
        f"Navigate to {BASE_URL} and wait for the page to be interactive. "
        "Read elements by their data-testid attribute and use each element's exact visible text. "
        "Step 1 (initial): the element data-testid='theme-label' text is exactly 'Theme: light'; "
        "the element data-testid='app-root' has attribute data-theme equal to 'light'; "
        "data-testid='cart-count' text is exactly '3'; data-testid='cart-total' text is exactly '$89.97'; "
        "data-testid='qty-sku-1' text is exactly '1'; data-testid='qty-sku-2' text is exactly '2'. "
        "Step 2: click the button data-testid='inc-sku-1' exactly once; then verify data-testid='qty-sku-1' is '2', "
        "data-testid='cart-count' is '4', and data-testid='cart-total' is '$139.96'. "
        "Step 3: click the button data-testid='theme-toggle' exactly once; then verify data-testid='theme-label' is "
        "'Theme: dark', the data-testid='app-root' element's data-theme attribute is 'dark', data-testid='cart-count' "
        "remains '4', and data-testid='cart-total' remains '$139.96'. "
        "Step 4: click the button data-testid='add-item' exactly once; then verify a row data-testid='item-sku-3' exists "
        "and contains the text 'Cable', data-testid='qty-sku-3' is '1', data-testid='cart-count' is '5', and "
        "data-testid='cart-total' is '$149.95'. "
        "Step 5: click data-testid='add-item' exactly once more; then verify there is still exactly one element with "
        "data-testid='item-sku-3' (no duplicate row), data-testid='cart-count' remains '5', and data-testid='cart-total' "
        "remains '$149.95'. "
        "Step 6: click the button data-testid='dec-sku-2' exactly once; then verify data-testid='qty-sku-2' is '1', "
        "data-testid='cart-count' is '4', and data-testid='cart-total' is '$129.96'. "
        "Step 7: click data-testid='dec-sku-2' two more times (three clicks total on this control); then verify "
        "data-testid='qty-sku-2' is '0' (it must never become negative), data-testid='cart-count' is '3', and "
        "data-testid='cart-total' is '$109.97'. "
        "The verification passes only if every one of these exact values is observed in order."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_client_resume_and_reactivity",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
