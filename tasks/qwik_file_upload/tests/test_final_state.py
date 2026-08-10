import hashlib
import os
import re
import socket
from concurrent.futures import ThreadPoolExecutor

import pytest
import requests
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/qwik-upload"
PORT = 3000
# Connect over IPv4 explicitly. On Node 17+ `localhost` may resolve to the IPv6
# loopback (::1), which can cause readiness checks and requests to hang.
HOST = "127.0.0.1"
BASE_URL = f"http://{HOST}:{PORT}"

PNG_SIG = b"\x89PNG\r\n\x1a\n"


# ---------------------------------------------------------------------------
# Fixture helpers to build fixtures with unique content
# ---------------------------------------------------------------------------
def make_png(extra_len: int = 64) -> bytes:
    """A file detected as PNG (starts with the PNG signature) plus a unique payload."""
    return PNG_SIG + os.urandom(max(1, extra_len))


def make_png_of_total_size(total: int) -> bytes:
    """A PNG-signature file whose total length equals `total` bytes."""
    assert total > len(PNG_SIG)
    return PNG_SIG + os.urandom(total - len(PNG_SIG))


def make_pdf(extra_len: int = 64) -> bytes:
    """A file detected as PDF (starts with %PDF-) plus a unique payload."""
    return b"%PDF-1.4\n" + os.urandom(max(1, extra_len)) + b"\n%%EOF\n"


def make_text(extra_len: int = 32) -> bytes:
    """A non-image/non-pdf file with a unique marker and no known signature."""
    return b"this is not an image " + os.urandom(max(1, extra_len))


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------
def get_action_url() -> str:
    """GET / and extract the upload form's action URL (its ?qaction=... target)."""
    resp = requests.get(BASE_URL + "/", timeout=30)
    assert resp.status_code == 200, f"GET / returned {resp.status_code}"
    m = re.search(r'qaction=([A-Za-z0-9_\-]+)', resp.text)
    assert m is not None, (
        "Could not find the upload form action (qaction) on GET /. "
        "The page must render a <Form> bound to a routeAction$."
    )
    return f"{BASE_URL}/?qaction={m.group(1)}"


def post_upload(action_url: str, file_bytes, filename: str,
                include_file: bool = True) -> requests.Response:
    data = {"filename": filename}
    files = None
    if include_file:
        files = {"file": ("upload.bin", file_bytes, "application/octet-stream")}
    return requests.post(action_url, data=data, files=files, timeout=60)


def parse_result_attrs(html: str) -> dict:
    """Extract the attributes of the single element with id="upload-result"."""
    m = re.search(r'<[^>]*\bid="upload-result"[^>]*>', html)
    assert m is not None, 'No element with id="upload-result" found in the response HTML.'
    tag = m.group(0)
    attrs = {}
    for key in ("data-status", "data-error-code", "data-dedup"):
        km = re.search(rf'{key}="([^"]*)"', tag)
        if km:
            attrs[key] = km.group(1)
    return attrs


def get_files():
    resp = requests.get(BASE_URL + "/api/files", timeout=30)
    assert resp.status_code == 200, f"GET /api/files returned {resp.status_code}"
    body = resp.json()
    assert isinstance(body, list), "GET /api/files must return a JSON array."
    return body


def find_by_sha(files, sha):
    return [f for f in files if f.get("sha256") == sha]


# ---------------------------------------------------------------------------
# Session fixtures: build then serve
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def build_result():
    import subprocess
    result = subprocess.run(
        ["npm", "run", "build"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=600,
    )
    print("===== npm run build stdout =====")
    print(result.stdout[-4000:])
    print("===== npm run build stderr =====")
    print(result.stderr[-4000:])
    return result


@pytest.fixture(scope="session")
def start_app(build_result, xprocess):
    assert build_result.returncode == 0, (
        f"'npm run build' failed (exit {build_result.returncode}). "
        f"stderr tail:\n{build_result.stderr[-2000:]}"
    )

    class Starter(ProcessStarter):
        name = "qwik_upload_server"
        args = ["npm", "run", "serve"]
        env = os.environ.copy()
        popen_kwargs = {"cwd": PROJECT_DIR, "text": True}
        timeout = 180
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex((HOST, PORT)) != 0:
                    return False
            try:
                resp = requests.get(BASE_URL + "/", timeout=20)
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

    yield BASE_URL

    capture_logs("TEARDOWN")
    info.terminate()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------
def test_accept_valid_png(start_app):
    p1 = make_png(128)
    sha = sha256_hex(p1)
    action = get_action_url()
    resp = post_upload(action, p1, "photo.png")
    attrs = parse_result_attrs(resp.text)
    assert attrs.get("data-status") == "success", f"Expected success for valid PNG, got {attrs}"
    assert attrs.get("data-dedup") == "false", f"Expected data-dedup=false for first upload, got {attrs}"

    matches = find_by_sha(get_files(), sha)
    assert len(matches) == 1, f"Expected exactly one /api/files entry for PNG sha256, got {len(matches)}"
    entry = matches[0]
    assert entry["contentType"] == "image/png", f"contentType must be image/png, got {entry['contentType']}"
    assert entry["size"] == len(p1), f"size must equal uploaded length {len(p1)}, got {entry['size']}"
    assert entry["originalName"] == "photo.png", f"originalName must be photo.png, got {entry['originalName']}"
    stored = entry["storedName"]
    assert stored and "/" not in stored and "\\" not in stored and ".." not in stored, \
        f"storedName must be non-empty and filesystem-safe, got {stored!r}"


def test_content_type_derived_from_content_not_filename(start_app):
    p2 = make_png(200)
    sha = sha256_hex(p2)
    action = get_action_url()
    resp = post_upload(action, p2, "report.pdf")
    attrs = parse_result_attrs(resp.text)
    assert attrs.get("data-status") == "success", f"Expected success, got {attrs}"

    matches = find_by_sha(get_files(), sha)
    assert len(matches) == 1, "Expected the PNG-with-.pdf-name upload to be stored once."
    assert matches[0]["contentType"] == "image/png", (
        "Content type must be detected from file bytes (image/png), not from the .pdf filename; "
        f"got {matches[0]['contentType']}"
    )


def test_accept_valid_pdf(start_app):
    d1 = make_pdf(256)
    sha = sha256_hex(d1)
    action = get_action_url()
    resp = post_upload(action, d1, "doc.pdf")
    attrs = parse_result_attrs(resp.text)
    assert attrs.get("data-status") == "success", f"Expected success for valid PDF, got {attrs}"

    matches = find_by_sha(get_files(), sha)
    assert len(matches) == 1, "Expected exactly one /api/files entry for the PDF."
    assert matches[0]["contentType"] == "application/pdf", \
        f"contentType must be application/pdf, got {matches[0]['contentType']}"


def test_reject_oversized(start_app):
    p3 = make_png_of_total_size(1_500_000)  # > 1 MiB
    sha = sha256_hex(p3)
    action = get_action_url()
    resp = post_upload(action, p3, "big.png")
    attrs = parse_result_attrs(resp.text)
    assert attrs.get("data-status") == "error", f"Oversized upload must be rejected, got {attrs}"
    assert attrs.get("data-error-code") == "file_too_large", \
        f"Expected error code file_too_large, got {attrs}"
    assert len(find_by_sha(get_files(), sha)) == 0, \
        "A rejected oversized file must not be stored in /api/files."


def test_reject_unsupported_type(start_app):
    t1 = make_text(64)
    sha = sha256_hex(t1)
    action = get_action_url()
    resp = post_upload(action, t1, "notes.png")
    attrs = parse_result_attrs(resp.text)
    assert attrs.get("data-status") == "error", f"Non-image/pdf upload must be rejected, got {attrs}"
    assert attrs.get("data-error-code") == "unsupported_type", \
        f"Expected error code unsupported_type, got {attrs}"
    assert len(find_by_sha(get_files(), sha)) == 0, \
        "A rejected unsupported file must not be stored in /api/files."


def test_reject_missing_or_empty_file(start_app):
    action = get_action_url()
    # Send an empty file part along with the filename field.
    resp = post_upload(action, b"", "empty.png", include_file=True)
    attrs = parse_result_attrs(resp.text)
    assert attrs.get("data-status") == "error", f"Empty file must be rejected, got {attrs}"
    assert attrs.get("data-error-code") == "no_file", \
        f"Expected error code no_file for an empty file, got {attrs}"


def test_filename_sanitization_prevents_traversal(start_app):
    p4 = make_png(180)
    sha = sha256_hex(p4)
    action = get_action_url()
    resp = post_upload(action, p4, "../../../../etc/passwd.png")
    attrs = parse_result_attrs(resp.text)
    assert attrs.get("data-status") == "success", f"Expected success, got {attrs}"

    matches = find_by_sha(get_files(), sha)
    assert len(matches) == 1, "Expected the traversal-named upload to be stored once."
    name = matches[0]["originalName"]
    assert name == "passwd.png", f"originalName must be sanitized to the basename 'passwd.png', got {name!r}"
    assert "/" not in name and "\\" not in name and ".." not in name, \
        f"Sanitized originalName must not contain path separators or '..', got {name!r}"


def test_unicode_filename_preserved(start_app):
    p5 = make_png(190)
    sha = sha256_hex(p5)
    action = get_action_url()
    resp = post_upload(action, p5, "reçu-möbï.png")
    attrs = parse_result_attrs(resp.text)
    assert attrs.get("data-status") == "success", f"Expected success, got {attrs}"

    matches = find_by_sha(get_files(), sha)
    assert len(matches) == 1, "Expected the unicode-named upload to be stored once."
    assert matches[0]["originalName"] == "reçu-möbï.png", \
        f"Unicode characters in the name must be preserved, got {matches[0]['originalName']!r}"


def test_dedup_sequential(start_app):
    p6 = make_png(220)
    sha = sha256_hex(p6)
    action = get_action_url()

    resp1 = post_upload(action, p6, "one.png")
    attrs1 = parse_result_attrs(resp1.text)
    assert attrs1.get("data-status") == "success", f"First upload should succeed, got {attrs1}"
    assert attrs1.get("data-dedup") == "false", f"First upload data-dedup must be false, got {attrs1}"

    resp2 = post_upload(action, p6, "two.png")
    attrs2 = parse_result_attrs(resp2.text)
    assert attrs2.get("data-status") == "success", f"Duplicate upload should succeed, got {attrs2}"
    assert attrs2.get("data-dedup") == "true", f"Duplicate upload data-dedup must be true, got {attrs2}"

    matches = find_by_sha(get_files(), sha)
    assert len(matches) == 1, \
        f"Identical content must be deduplicated to exactly one entry, got {len(matches)}"


def test_dedup_concurrent(start_app):
    p7 = make_png(240)
    sha = sha256_hex(p7)
    action = get_action_url()

    def worker(_):
        return post_upload(action, p7, "c.png").status_code

    with ThreadPoolExecutor(max_workers=8) as ex:
        list(ex.map(worker, range(8)))

    matches = find_by_sha(get_files(), sha)
    assert len(matches) == 1, (
        f"Concurrent identical uploads must result in exactly one stored entry, got {len(matches)}"
    )


def test_download_stream(start_app):
    p1 = make_png(300)
    sha = sha256_hex(p1)
    action = get_action_url()
    resp = post_upload(action, p1, "photo.png")
    assert parse_result_attrs(resp.text).get("data-status") == "success", "Upload for download test failed."

    matches = find_by_sha(get_files(), sha)
    assert len(matches) == 1, "Upload for download test not found in /api/files."
    stored = matches[0]["storedName"]

    dl = requests.get(f"{BASE_URL}/api/files/download/{stored}", timeout=30)
    assert dl.status_code == 200, f"Download returned {dl.status_code}"
    assert dl.content == p1, "Downloaded bytes must exactly equal the uploaded bytes."
    ctype = dl.headers.get("Content-Type", "")
    assert ctype.startswith("image/png"), f"Download Content-Type must be image/png, got {ctype!r}"
    disp = dl.headers.get("Content-Disposition", "")
    assert "attachment" in disp and 'filename="photo.png"' in disp, \
        f"Content-Disposition must be attachment with filename=\"photo.png\", got {disp!r}"


def test_download_unknown_returns_404(start_app):
    dl = requests.get(f"{BASE_URL}/api/files/download/nonexistent-{os.urandom(6).hex()}", timeout=30)
    assert dl.status_code == 404, f"Unknown stored name must return 404, got {dl.status_code}"


def test_build_succeeds_and_no_server_module_leak(build_result):
    assert build_result.returncode == 0, (
        f"'npm run build' must succeed. stderr tail:\n{build_result.stderr[-2000:]}"
    )
    dist_dir = os.path.join(PROJECT_DIR, "dist")
    assert os.path.isdir(dist_dir), f"Client build output {dist_dir} does not exist after build."

    offenders = []
    for root, _dirs, filenames in os.walk(dist_dir):
        for fn in filenames:
            if not fn.endswith(".js"):
                continue
            path = os.path.join(root, fn)
            try:
                with open(path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
            except OSError:
                continue
            if "better-sqlite3" in content or "node:fs" in content:
                offenders.append(path)

    assert not offenders, (
        "Server-only modules leaked into the client bundle "
        f"(found 'better-sqlite3' or 'node:fs' in): {offenders}"
    )
