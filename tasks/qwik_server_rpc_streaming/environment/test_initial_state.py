import json
import os
import shutil

import pytest

PROJECT_DIR = "/home/user/project"


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_package_json_exists_and_depends_on_qwik():
    package_json = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(package_json), f"{package_json} does not exist."
    with open(package_json) as f:
        data = json.load(f)
    deps = {}
    deps.update(data.get("dependencies", {}))
    deps.update(data.get("devDependencies", {}))
    assert "@builder.io/qwik" in deps, "Expected @builder.io/qwik to be a dependency."
    assert "@builder.io/qwik-city" in deps, "Expected @builder.io/qwik-city to be a dependency."


def test_qwik_installed_in_node_modules():
    qwik_pkg = os.path.join(PROJECT_DIR, "node_modules", "@builder.io", "qwik", "package.json")
    qwik_city_pkg = os.path.join(
        PROJECT_DIR, "node_modules", "@builder.io", "qwik-city", "package.json"
    )
    assert os.path.isfile(qwik_pkg), "@builder.io/qwik is not installed in node_modules."
    assert os.path.isfile(qwik_city_pkg), "@builder.io/qwik-city is not installed in node_modules."


def test_vite_config_exists():
    vite_config = os.path.join(PROJECT_DIR, "vite.config.ts")
    assert os.path.isfile(vite_config), f"{vite_config} does not exist."


def test_route_index_exists():
    index_tsx = os.path.join(PROJECT_DIR, "src", "routes", "index.tsx")
    assert os.path.isfile(index_tsx), f"{index_tsx} does not exist."


def test_route_index_uses_server_rpc():
    index_tsx = os.path.join(PROJECT_DIR, "src", "routes", "index.tsx")
    with open(index_tsx) as f:
        content = f.read()
    assert "server$" in content, "The route is expected to use a server$ RPC in the initial state."


def test_events_log_exists_with_expected_lines():
    events_log = os.path.join(PROJECT_DIR, "data", "events.log")
    assert os.path.isfile(events_log), f"{events_log} does not exist."
    with open(events_log) as f:
        lines = [ln.strip() for ln in f.read().splitlines() if ln.strip()]
    expected = [
        "INFO|Server started",
        "INFO|Listening on port 3000",
        "WARN|High memory usage",
        "ERROR|Failed to connect to cache",
        "INFO|Retrying connection",
        "ERROR|Timeout while reading stream",
        "WARN|Slow response detected",
        "INFO|Shutdown complete",
    ]
    assert lines == expected, f"Unexpected initial contents of events.log: {lines}"
