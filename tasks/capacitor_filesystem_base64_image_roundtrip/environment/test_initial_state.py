import json
import os
import shutil

PROJECT_DIR = "/home/user/capacitor-fs-roundtrip"


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_package_json_declares_capacitor_deps():
    pkg_path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(pkg_path), f"package.json not found at {pkg_path}."
    with open(pkg_path) as f:
        pkg = json.load(f)
    deps = {}
    deps.update(pkg.get("dependencies", {}) or {})
    deps.update(pkg.get("devDependencies", {}) or {})
    assert "@capacitor/core" in deps, "@capacitor/core is not declared in package.json."
    assert "@capacitor/filesystem" in deps, "@capacitor/filesystem is not declared in package.json."


def test_capacitor_filesystem_installed():
    fs_pkg = os.path.join(PROJECT_DIR, "node_modules", "@capacitor", "filesystem", "package.json")
    assert os.path.isfile(fs_pkg), "@capacitor/filesystem is not installed in node_modules."


def test_capacitor_core_installed():
    core_pkg = os.path.join(PROJECT_DIR, "node_modules", "@capacitor", "core", "package.json")
    assert os.path.isfile(core_pkg), "@capacitor/core is not installed in node_modules."


def test_sample_png_asset_present_and_valid():
    asset = os.path.join(PROJECT_DIR, "public", "sample.png")
    assert os.path.isfile(asset), f"Bundled image asset {asset} does not exist."
    with open(asset, "rb") as f:
        header = f.read(8)
    assert header == b"\x89PNG\r\n\x1a\n", "public/sample.png does not have a valid PNG signature."
    assert os.path.getsize(asset) > 8, "public/sample.png appears to be empty."


def test_index_html_contains_required_elements():
    index_path = os.path.join(PROJECT_DIR, "index.html")
    assert os.path.isfile(index_path), f"index.html not found at {index_path}."
    with open(index_path) as f:
        html = f.read()
    for element_id in [
        "status",
        "original-hash",
        "readback-hash",
        "match",
        "byte-length",
        "write-uri",
        "dir-listing",
    ]:
        assert f'id="{element_id}"' in html, f'index.html is missing an element with id="{element_id}".'


def test_main_ts_stub_exists():
    main_ts = os.path.join(PROJECT_DIR, "src", "main.ts")
    assert os.path.isfile(main_ts), f"src/main.ts stub not found at {main_ts}."
