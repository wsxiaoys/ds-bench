import os
import shutil

PROJECT_DIR = "/home/user/app"


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_package_json_exists():
    path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(path), f"Expected {path} to exist."


def test_capacitor_config_exists():
    path = os.path.join(PROJECT_DIR, "capacitor.config.ts")
    assert os.path.isfile(path), f"Expected {path} to exist."


def test_index_html_exists_with_composer():
    path = os.path.join(PROJECT_DIR, "index.html")
    assert os.path.isfile(path), f"Expected {path} to exist."
    with open(path) as f:
        content = f.read()
    assert 'id="composer"' in content, \
        "Expected index.html to already contain the composer element (id=\"composer\")."


def test_main_entry_exists():
    path = os.path.join(PROJECT_DIR, "src", "main.ts")
    assert os.path.isfile(path), f"Expected {path} to exist."


def test_stylesheet_uses_keyboard_offset_variable():
    css_path = os.path.join(PROJECT_DIR, "src", "style.css")
    assert os.path.isfile(css_path), f"Expected {css_path} to exist."
    with open(css_path) as f:
        content = f.read()
    assert "--keyboard-offset" in content, \
        "Expected the stylesheet to already consume the --keyboard-offset CSS variable."


def test_keyboard_plugin_installed():
    pkg = os.path.join(PROJECT_DIR, "node_modules", "@capacitor", "keyboard", "package.json")
    assert os.path.isfile(pkg), \
        "Expected @capacitor/keyboard to be installed in node_modules."


def test_capacitor_core_installed():
    pkg = os.path.join(PROJECT_DIR, "node_modules", "@capacitor", "core", "package.json")
    assert os.path.isfile(pkg), \
        "Expected @capacitor/core to be installed in node_modules."


def test_capacitor_cli_installed():
    pkg = os.path.join(PROJECT_DIR, "node_modules", "@capacitor", "cli", "package.json")
    assert os.path.isfile(pkg), \
        "Expected @capacitor/cli to be installed in node_modules."


def test_keyboard_plugin_not_yet_configured():
    path = os.path.join(PROJECT_DIR, "capacitor.config.ts")
    with open(path) as f:
        content = f.read()
    assert "Keyboard" not in content, \
        "Starting capacitor.config.ts should not yet configure the Keyboard plugin."
