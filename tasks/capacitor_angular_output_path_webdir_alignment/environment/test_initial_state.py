import os
import re
import shutil

PROJECT_DIR = "/home/user/mobileapp"


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_angular_workspace_files_exist():
    angular_json = os.path.join(PROJECT_DIR, "angular.json")
    package_json = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(angular_json), f"Expected Angular workspace file {angular_json} to exist."
    assert os.path.isfile(package_json), f"Expected {package_json} to exist."


def test_capacitor_config_exists_with_webdir():
    config_path = os.path.join(PROJECT_DIR, "capacitor.config.ts")
    assert os.path.isfile(config_path), f"Expected Capacitor config {config_path} to exist."
    with open(config_path) as f:
        content = f.read()
    assert "webDir" in content, "capacitor.config.ts must declare a webDir property."


def test_dependencies_installed():
    node_modules = os.path.join(PROJECT_DIR, "node_modules")
    assert os.path.isdir(node_modules), "node_modules is missing; project dependencies are not installed."
    ng_bin = os.path.join(node_modules, ".bin", "ng")
    cap_bin = os.path.join(node_modules, ".bin", "cap")
    assert os.path.isfile(ng_bin), "Angular CLI (node_modules/.bin/ng) is not installed."
    assert os.path.isfile(cap_bin), "Capacitor CLI (node_modules/.bin/cap) is not installed."
    cap_core = os.path.join(node_modules, "@capacitor", "core")
    assert os.path.isdir(cap_core), "@capacitor/core is not installed."


def test_no_native_platforms_added():
    # The task must be solved with configuration only; no native platform should be present initially.
    assert not os.path.isdir(os.path.join(PROJECT_DIR, "android")), "An android platform should not be present initially."
    assert not os.path.isdir(os.path.join(PROJECT_DIR, "ios")), "An ios platform should not be present initially."


def test_starts_in_broken_state():
    # The webDir declared in the Capacitor config must not yet resolve to a directory
    # containing a built index.html (the friction the agent needs to fix).
    config_path = os.path.join(PROJECT_DIR, "capacitor.config.ts")
    with open(config_path) as f:
        content = f.read()
    match = re.search(r"webDir\s*:\s*['\"]([^'\"]+)['\"]", content)
    assert match is not None, "Could not read the webDir value from capacitor.config.ts."
    web_dir = match.group(1)
    resolved = os.path.join(PROJECT_DIR, web_dir)
    index_html = os.path.join(resolved, "index.html")
    assert not os.path.isfile(index_html), (
        f"Initial state is already solved: {index_html} already exists. "
        "The environment should start without an aligned/built webDir."
    )
