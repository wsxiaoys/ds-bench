import os
import socket
import subprocess

import pytest
import requests
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/project"
PORT = 4173
# Bind/connect over IPv4 explicitly. On Node 17+ `localhost` can resolve to the
# IPv6 loopback (::1), so the preview server may listen on ::1 only while an
# AF_INET socket to 127.0.0.1 never connects -> the readiness check would hang.
HOST = "127.0.0.1"
BASE_URL = f"http://{HOST}:{PORT}"

# Source tree that will be seeded into Directory.Data inside the browser.
SEED = {
    "readme.txt": "hello world",
    "data/a.json": "{\"n\":1}",
    "data/nested/deep.txt": "deep content",
    "notes/unicode.txt": "café ☕",
}
EMPTY_DIR = "images"

EXPECTED_FILE_PATHS = [
    "data/a.json",
    "data/nested/deep.txt",
    "notes/unicode.txt",
    "readme.txt",
]
EXPECTED_DIRECTORIES = ["data", "data/nested", "images", "notes"]

# JavaScript harness executed inside the page. It seeds a directory tree using the
# real @capacitor/filesystem web implementation (exposed by the app on
# window.CapacitorFilesystem), invokes the function under test
# (window.runDirectoryExport), and returns everything Python needs to assert on.
HARNESS_JS = r"""
async () => {
  const { Filesystem, Directory, Encoding } = window.CapacitorFilesystem;
  const D = Directory.Data;

  // Start clean so re-runs are deterministic.
  for (const p of ["src", "dest"]) {
    try { await Filesystem.rmdir({ path: p, directory: D, recursive: true }); } catch (e) {}
  }
  try { await Filesystem.deleteFile({ path: "manifest.json", directory: D }); } catch (e) {}

  const seed = {
    "readme.txt": "hello world",
    "data/a.json": "{\"n\":1}",
    "data/nested/deep.txt": "deep content",
    "notes/unicode.txt": "café ☕",
  };
  for (const rel of Object.keys(seed)) {
    await Filesystem.writeFile({
      path: "src/" + rel,
      directory: D,
      data: seed[rel],
      encoding: Encoding.UTF8,
      recursive: true,
    });
  }
  await Filesystem.mkdir({ path: "src/images", directory: D, recursive: true });

  const returned = await window.runDirectoryExport({
    sourceDir: "src",
    destDir: "dest",
    manifestPath: "manifest.json",
  });

  const manRead = await Filesystem.readFile({
    path: "manifest.json",
    directory: D,
    encoding: Encoding.UTF8,
  });
  const manifest = JSON.parse(manRead.data);

  const statSizes = {};
  for (const rel of Object.keys(seed)) {
    const st = await Filesystem.stat({ path: "src/" + rel, directory: D });
    statSizes[rel] = st.size;
  }

  const destContents = {};
  for (const rel of Object.keys(seed)) {
    const r = await Filesystem.readFile({
      path: "dest/" + rel,
      directory: D,
      encoding: Encoding.UTF8,
    });
    destContents[rel] = r.data;
  }

  let destImages = null;
  let destImagesError = null;
  try {
    const rd = await Filesystem.readdir({ path: "dest/images", directory: D });
    destImages = rd.files.map((f) => f.name);
  } catch (e) {
    destImagesError = String(e);
  }

  let destNested = null;
  let destNestedError = null;
  try {
    const rd = await Filesystem.readdir({ path: "dest/data/nested", directory: D });
    destNested = rd.files.map((f) => f.name);
  } catch (e) {
    destNestedError = String(e);
  }

  return {
    returned,
    manifest,
    statSizes,
    destContents,
    destImages,
    destImagesError,
    destNested,
    destNestedError,
  };
}
"""


@pytest.fixture(scope="session")
def built_app():
    """Produce a production build for preview.

    Dependencies are already installed in the image (offline-friendly). Only run
    `npm install` as a fallback if node_modules is missing.
    """
    if not os.path.isdir(os.path.join(PROJECT_DIR, "node_modules")):
        install = subprocess.run(
            ["npm", "install"], cwd=PROJECT_DIR, capture_output=True, text=True, timeout=900
        )
        assert install.returncode == 0, (
            f"'npm install' failed:\n{install.stdout}\n{install.stderr}"
        )

    build = subprocess.run(
        ["npm", "run", "build"], cwd=PROJECT_DIR, capture_output=True, text=True, timeout=900
    )
    assert build.returncode == 0, f"'npm run build' failed:\n{build.stdout}\n{build.stderr}"
    return True


@pytest.fixture(scope="session")
def start_app(xprocess, built_app):
    """Start the Vite preview server on the IPv4 loopback and wait until ready."""

    class Starter(ProcessStarter):
        name = "start_app"
        args = ["npm", "run", "preview", "--", "--host", HOST, "--port", str(PORT), "--strictPort"]
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
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
    printed_log_lines = 0

    def capture_logs(tag):
        nonlocal printed_log_lines
        with open(info.logpath, "r") as f:
            all_lines = f.readlines()
        new_lines = all_lines[printed_log_lines:]
        skipped = printed_log_lines
        printed_log_lines = len(all_lines)
        print(f"=============== [{tag}: Begin] {Starter.name} logfile ===============")
        if skipped > 0:
            print(f"(skipped {skipped} already-printed lines)")
        print("".join(new_lines))
        print(f"=============== [{tag}: End  ] {Starter.name} logfile ===============")

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
def export_result(start_app):
    """Load the app in a headless browser, run the export harness, return its output."""
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
        try:
            page = browser.new_page()
            page.goto(BASE_URL, wait_until="load")
            page.wait_for_function(
                "() => !!(window.CapacitorFilesystem && window.runDirectoryExport)",
                timeout=30000,
            )
            result = page.evaluate(HARNESS_JS)
        finally:
            browser.close()
    return result


def test_globals_exposed(export_result):
    assert isinstance(export_result.get("manifest"), dict), (
        "window.runDirectoryExport did not produce a manifest object; ensure the app exposes "
        "window.CapacitorFilesystem and window.runDirectoryExport on load."
    )


def test_manifest_files_paths(export_result):
    manifest = export_result["manifest"]
    assert isinstance(manifest.get("files"), list), "manifest.files must be an array."
    paths = [f["path"] for f in manifest["files"]]
    assert paths == EXPECTED_FILE_PATHS, (
        f"manifest.files paths mismatch. Expected {EXPECTED_FILE_PATHS} "
        f"(POSIX relative paths sorted ascending), got {paths}."
    )


def test_manifest_file_sizes_match_stat(export_result):
    manifest = export_result["manifest"]
    stat_sizes = export_result["statSizes"]
    for entry in manifest["files"]:
        rel = entry["path"]
        assert rel in stat_sizes, f"Unexpected file path in manifest: {rel}."
        assert entry["size"] == stat_sizes[rel], (
            f"Size for '{rel}' should equal the Filesystem stat size {stat_sizes[rel]}, "
            f"got {entry['size']}."
        )


def test_manifest_directories(export_result):
    manifest = export_result["manifest"]
    assert manifest.get("directories") == EXPECTED_DIRECTORIES, (
        f"manifest.directories should be {EXPECTED_DIRECTORIES} (includes the empty 'images' "
        f"folder, sorted ascending), got {manifest.get('directories')}."
    )


def test_manifest_totals(export_result):
    manifest = export_result["manifest"]
    assert manifest.get("totalFiles") == 4, (
        f"manifest.totalFiles should be 4, got {manifest.get('totalFiles')}."
    )
    expected_total_bytes = sum(f["size"] for f in manifest["files"])
    assert manifest.get("totalBytes") == expected_total_bytes, (
        f"manifest.totalBytes should equal the sum of file sizes ({expected_total_bytes}), "
        f"got {manifest.get('totalBytes')}."
    )


def test_manifest_matches_return_value(export_result):
    assert export_result["manifest"] == export_result["returned"], (
        "The object returned by window.runDirectoryExport must deep-equal the JSON written "
        "to the manifest file."
    )


def test_destination_file_copies(export_result):
    dest_contents = export_result["destContents"]
    for rel, content in SEED.items():
        assert dest_contents.get(rel) == content, (
            f"Destination copy 'dest/{rel}' content mismatch. Expected {content!r}, "
            f"got {dest_contents.get(rel)!r}."
        )


def test_destination_empty_folder_recreated(export_result):
    assert export_result["destImagesError"] is None, (
        f"Empty directory 'dest/images' was not recreated in the destination: "
        f"{export_result['destImagesError']}."
    )
    assert export_result["destImages"] == [], (
        f"'dest/images' should be an empty directory, got entries {export_result['destImages']}."
    )


def test_destination_nested_directory(export_result):
    assert export_result["destNestedError"] is None, (
        f"Nested directory 'dest/data/nested' was not recreated: {export_result['destNestedError']}."
    )
    assert "deep.txt" in (export_result["destNested"] or []), (
        f"'dest/data/nested' should contain 'deep.txt', got {export_result['destNested']}."
    )
