import base64
import os
import socket
import time
from urllib.parse import urljoin

import pytest
import requests
from xprocess import ProcessStarter
from playwright.sync_api import sync_playwright

PROJECT_DIR = "/home/user/upload-gallery"
PORT = 4813
# Bind/connect over IPv4 explicitly. On Node 17+ `localhost` can resolve to the
# IPv6 loopback (::1); connecting to 127.0.0.1 avoids a hang if the server only
# advertised localhost.
HOST = "127.0.0.1"
BASE_URL = f"http://{HOST}:{PORT}"

MAX_SIZE = 2097152  # 2 MiB
UI_TIMEOUT = 30000  # ms

# A real, minimal 1x1 PNG image (well under the size limit), MIME image/png.
VALID_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk"
    "+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
)
# A valid-typed image (image/png) whose size is strictly greater than the limit.
with open("/bootstrap/file_example_png_3mb.png", "rb") as f:
    BIG_PNG = f.read()
# A plain-text file (image/* not allowed).
NOTE_TXT = b"this is not an image, it is plain text.\n"


# --------------------------------------------------------------------------- #
# Application lifecycle
# --------------------------------------------------------------------------- #
@pytest.fixture(scope="session")
def start_app(xprocess):
    class Starter(ProcessStarter):
        name = "upload_gallery"
        args = ["npm", "run", "start"]
        env = os.environ.copy()
        popen_kwargs = {"cwd": PROJECT_DIR, "text": True}
        timeout = 300
        terminate_on_interrupt = True
        max_read_lines = 5000

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex((HOST, PORT)) != 0:
                    return False
            try:
                resp = requests.get(BASE_URL + "/", timeout=30)
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
        print(f"===== [{tag}] {Starter.name} log begin =====")
        print("".join(new))
        print(f"===== [{tag}] {Starter.name} log end   =====")

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
        b = p.chromium.launch(headless=True)
        yield b
        b.close()


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def upload_via_api(filename, content, mime):
    return requests.post(
        f"{BASE_URL}/api/upload",
        files={"file": (filename, content, mime)},
        timeout=60,
    )


def get_list():
    resp = requests.get(f"{BASE_URL}/api/files", timeout=30)
    assert resp.status_code == 200, (
        f"GET /api/files expected 200, got {resp.status_code}"
    )
    return resp.json()


def new_page(browser):
    page = browser.new_page()
    page.set_default_timeout(UI_TIMEOUT)
    page.goto(BASE_URL + "/", wait_until="networkidle")
    return page


def item_by_filename(page, name):
    return page.locator('[data-testid="gallery-item"]').filter(
        has=page.locator(f'[data-testid="file-name"]:text-is("{name}")')
    )


def item_by_id(page, file_id):
    return page.locator(f'[data-testid="gallery-item"][data-file-id="{file_id}"]')


# --------------------------------------------------------------------------- #
# Direct HTTP verification
# --------------------------------------------------------------------------- #
def test_reject_disallowed_mime_type(start_app):
    resp = upload_via_api("note.txt", NOTE_TXT, "text/plain")
    assert resp.status_code == 400, (
        f"Uploading a text/plain file must be rejected with 400, got "
        f"{resp.status_code}: {resp.text}"
    )
    body = resp.json()
    assert isinstance(body.get("error"), str) and body["error"].strip(), (
        f"Rejected upload must return a non-empty string 'error'; got {body!r}"
    )
    listing = get_list()
    assert all(item.get("filename") != "note.txt" for item in listing), (
        "A rejected disallowed-type upload must not be persisted in /api/files."
    )


def test_reject_oversized_file(start_app):
    assert len(BIG_PNG) > MAX_SIZE
    resp = upload_via_api("big.png", BIG_PNG, "image/png")
    assert resp.status_code == 400, (
        f"Uploading a file larger than {MAX_SIZE} bytes must be rejected with 400, "
        f"got {resp.status_code}: {resp.text[:200]}"
    )
    body = resp.json()
    assert isinstance(body.get("error"), str) and body["error"].strip(), (
        f"Rejected upload must return a non-empty string 'error'; got {body!r}"
    )
    listing = get_list()
    assert all(item.get("filename") != "big.png" for item in listing), (
        "A rejected oversized upload must not be persisted in /api/files."
    )


def test_upload_serve_and_list(start_app):
    resp = upload_via_api("valid.png", VALID_PNG, "image/png")
    assert resp.status_code == 201, (
        f"Valid upload must return 201, got {resp.status_code}: {resp.text[:200]}"
    )
    body = resp.json()
    for key in ("id", "filename", "size", "mime", "uploadedAt"):
        assert key in body, f"Upload response missing key '{key}': {body!r}"
    assert body["filename"] == "valid.png", f"Wrong filename: {body!r}"
    assert body["size"] == len(VALID_PNG), (
        f"Reported size {body['size']} != actual {len(VALID_PNG)}"
    )
    assert body["mime"] == "image/png", f"Wrong mime: {body!r}"
    file_id = body["id"]
    assert isinstance(file_id, int), f"id must be an integer, got {file_id!r}"

    # Serve the bytes back with the correct content type.
    served = requests.get(f"{BASE_URL}/api/files/{file_id}", timeout=30)
    assert served.status_code == 200, (
        f"GET /api/files/{file_id} expected 200, got {served.status_code}"
    )
    assert "image/png" in served.headers.get("Content-Type", "").lower(), (
        f"Served file Content-Type must be image/png, got "
        f"{served.headers.get('Content-Type')!r}"
    )
    assert served.content == VALID_PNG, (
        "Served bytes are not byte-for-byte identical to the uploaded file."
    )

    # Appears in the listing with correct metadata.
    listing = get_list()
    match = [i for i in listing if i.get("id") == file_id]
    assert match, f"Uploaded file id={file_id} not present in /api/files listing."
    entry = match[0]
    assert entry["filename"] == "valid.png"
    assert entry["mime"] == "image/png"
    assert entry["size"] == len(VALID_PNG)


def test_list_ordered_most_recent_first(start_app):
    # Upload two files and confirm ids are returned in strictly descending order.
    upload_via_api("valid.png", VALID_PNG, "image/png")
    time.sleep(0.05)
    upload_via_api("valid.png", VALID_PNG, "image/png")
    listing = get_list()
    ids = [i["id"] for i in listing if isinstance(i.get("id"), int)]
    assert ids == sorted(ids, reverse=True), (
        f"/api/files must be ordered most-recently-uploaded first; got ids {ids}"
    )


# --------------------------------------------------------------------------- #
# Browser verification (Playwright, real headless Chromium)
# --------------------------------------------------------------------------- #
def _write_asset(tmp_path, name, content):
    p = tmp_path / name
    p.write_bytes(content)
    return str(p)


def test_browser_upload_valid_and_served(browser, tmp_path):
    page = new_page(browser)
    asset = _write_asset(tmp_path, "valid.png", VALID_PNG)

    page.set_input_files('[data-testid="file-input"]', asset)
    page.click('[data-testid="upload-button"]')

    item = item_by_filename(page, "valid.png").first
    item.wait_for(state="visible", timeout=UI_TIMEOUT)

    file_id = item.get_attribute("data-file-id")
    assert file_id, "Gallery item is missing the data-file-id attribute."
    href = item.locator('a[data-testid="file-link"]').first.get_attribute("href")
    assert href, "Gallery item is missing an a[data-testid=file-link] href."
    assert href.rstrip("/").endswith(f"/api/files/{file_id}"), (
        f"file-link href {href!r} must resolve to /api/files/{file_id}"
    )

    served = requests.get(urljoin(BASE_URL, href), timeout=30)
    assert served.status_code == 200, (
        f"Served file link returned {served.status_code}, expected 200."
    )
    assert "image/png" in served.headers.get("Content-Type", "").lower(), (
        "Served file link must respond with Content-Type image/png."
    )
    page.close()


def test_browser_rejects_disallowed_type(browser, tmp_path):
    page = new_page(browser)
    asset = _write_asset(tmp_path, "note.txt", NOTE_TXT)

    page.set_input_files('[data-testid="file-input"]', asset)
    page.click('[data-testid="upload-button"]')

    err = page.locator('[data-testid="upload-error"]')
    err.wait_for(state="visible", timeout=UI_TIMEOUT)
    assert (err.inner_text() or "").strip(), (
        "upload-error must contain a non-empty message on rejection."
    )
    assert item_by_filename(page, "note.txt").count() == 0, (
        "A rejected disallowed-type file must not appear as a gallery item."
    )
    page.close()


def test_browser_rejects_oversized(browser, tmp_path):
    page = new_page(browser)
    asset = _write_asset(tmp_path, "big.png", BIG_PNG)

    page.set_input_files('[data-testid="file-input"]', asset)
    page.click('[data-testid="upload-button"]')

    err = page.locator('[data-testid="upload-error"]')
    err.wait_for(state="visible", timeout=UI_TIMEOUT)
    assert (err.inner_text() or "").strip(), (
        "upload-error must contain a non-empty message on rejection."
    )
    assert item_by_filename(page, "big.png").count() == 0, (
        "A rejected oversized file must not appear as a gallery item."
    )
    page.close()


def test_browser_delete_removes_and_unserves(browser, tmp_path):
    page = new_page(browser)
    asset = _write_asset(tmp_path, "valid.png", VALID_PNG)

    page.set_input_files('[data-testid="file-input"]', asset)
    page.click('[data-testid="upload-button"]')

    item = item_by_filename(page, "valid.png").first
    item.wait_for(state="visible", timeout=UI_TIMEOUT)
    file_id = item.get_attribute("data-file-id")
    href = item.locator('a[data-testid="file-link"]').first.get_attribute("href")
    assert file_id and href

    # Sanity: it is served before deletion.
    assert requests.get(urljoin(BASE_URL, href), timeout=30).status_code == 200

    item.locator('[data-testid="delete-button"]').first.click()

    # The specific item disappears from the page.
    item_by_id(page, file_id).wait_for(state="detached", timeout=UI_TIMEOUT)

    served = requests.get(f"{BASE_URL}/api/files/{file_id}", timeout=30)
    assert served.status_code == 404, (
        f"After deletion GET /api/files/{file_id} must return 404, got "
        f"{served.status_code}"
    )
    listing = get_list()
    assert all(str(i.get("id")) != str(file_id) for i in listing), (
        f"Deleted file id={file_id} must no longer appear in /api/files."
    )
    page.close()


def test_metadata_persists_after_reload(browser):
    # Upload via API, then load the page fresh and confirm it is present.
    resp = upload_via_api("valid.png", VALID_PNG, "image/png")
    assert resp.status_code == 201, f"Setup upload failed: {resp.status_code}"
    file_id = resp.json()["id"]

    page = new_page(browser)
    page.reload(wait_until="networkidle")

    item = item_by_id(page, str(file_id))
    item.wait_for(state="visible", timeout=UI_TIMEOUT)
    name = item.locator('[data-testid="file-name"]').first.inner_text()
    assert "valid.png" in name, (
        f"Persisted gallery item shows wrong filename: {name!r}"
    )
    page.close()

    served = requests.get(f"{BASE_URL}/api/files/{file_id}", timeout=30)
    assert served.status_code == 200, (
        "Uploaded file must still be served after reload (durable storage)."
    )
    assert "image/png" in served.headers.get("Content-Type", "").lower()
