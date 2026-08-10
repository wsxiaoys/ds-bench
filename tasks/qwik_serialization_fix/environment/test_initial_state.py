import json
import os
import shutil

PROJECT_DIR = "/home/user/keyword-tally"


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_qwik_installed():
    pkg = os.path.join(PROJECT_DIR, "node_modules", "@builder.io", "qwik", "package.json")
    assert os.path.isfile(pkg), (
        "@builder.io/qwik is not installed in the project's node_modules."
    )


def test_qwik_city_installed():
    pkg = os.path.join(
        PROJECT_DIR, "node_modules", "@builder.io", "qwik-city", "package.json"
    )
    assert os.path.isfile(pkg), (
        "@builder.io/qwik-city is not installed in the project's node_modules."
    )


def test_package_json_pins_qwik_version():
    package_json = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(package_json), f"{package_json} does not exist."
    with open(package_json) as f:
        data = json.load(f)
    deps = data.get("dependencies", {})
    assert deps.get("@builder.io/qwik") == "1.15.0", (
        "Expected @builder.io/qwik to be pinned to 1.15.0 in package.json dependencies."
    )
    assert deps.get("@builder.io/qwik-city") == "1.15.0", (
        "Expected @builder.io/qwik-city to be pinned to 1.15.0 in package.json dependencies."
    )


def test_index_route_exists():
    index_route = os.path.join(PROJECT_DIR, "src", "routes", "index.tsx")
    assert os.path.isfile(index_route), (
        f"The page component {index_route} does not exist."
    )


def test_activity_recorder_exists():
    recorder = os.path.join(PROJECT_DIR, "src", "lib", "activity-recorder.ts")
    assert os.path.isfile(recorder), (
        f"The browser-only utility {recorder} does not exist."
    )


def test_vite_config_exists():
    vite_config = os.path.join(PROJECT_DIR, "vite.config.ts")
    assert os.path.isfile(vite_config), f"{vite_config} does not exist."


def test_static_adapter_config_exists():
    adapter_config = os.path.join(PROJECT_DIR, "adapters", "static", "vite.config.ts")
    assert os.path.isfile(adapter_config), (
        f"The static site adapter config {adapter_config} does not exist."
    )
