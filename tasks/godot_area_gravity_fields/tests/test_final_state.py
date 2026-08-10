import os
import re
import shutil
import subprocess

import pytest


PROJECT_DIR = "/home/user/gravity_fields"
ZEALT_TESTS_DIR = os.path.join(PROJECT_DIR, "_zealt_tests")
HARNESS_SRC_DIR = "/tests"
HARNESS_FILES = [
    "test_harness_struct.gd",
    "test_harness_struct.tscn",
    "test_harness_probe.gd",
    "test_harness_probe.tscn",
    "test_harness_traj.gd",
    "test_harness_traj.tscn",
]

XDG_DATA_HOME = "/tmp/godot_test_xdg"


def _godot_env() -> dict:
    env = os.environ.copy()
    env["XDG_DATA_HOME"] = XDG_DATA_HOME
    env.pop("DISPLAY", None)
    return env


def _reset_user_data() -> None:
    if os.path.isdir(XDG_DATA_HOME):
        shutil.rmtree(XDG_DATA_HOME, ignore_errors=True)
    os.makedirs(XDG_DATA_HOME, exist_ok=True)


def _install_harnesses() -> None:
    os.makedirs(ZEALT_TESTS_DIR, exist_ok=True)
    for fname in HARNESS_FILES:
        src = os.path.join(HARNESS_SRC_DIR, fname)
        dst = os.path.join(ZEALT_TESTS_DIR, fname)
        assert os.path.isfile(src), f"Harness source missing: {src}"
        shutil.copyfile(src, dst)


def _read_text(path: str) -> str:
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        return f.read()


def _run_harness(scene: str, marker: str, timeout: int) -> None:
    _reset_user_data()
    result = subprocess.run(
        ["godot", "--headless", "--path", PROJECT_DIR, f"res://_zealt_tests/{scene}"],
        capture_output=True,
        text=True,
        timeout=timeout,
        env=_godot_env(),
    )
    combined = (result.stdout or "") + (result.stderr or "")
    assert result.returncode == 0, (
        f"Harness {scene} exited with code {result.returncode}:\n{combined}"
    )
    assert marker in result.stdout, (
        f"Harness {scene} did not print {marker}. Output:\n{combined}"
    )


@pytest.fixture(scope="module", autouse=True)
def _setup_module():
    _install_harnesses()
    yield
    shutil.rmtree(ZEALT_TESTS_DIR, ignore_errors=True)


# ---------------------------------------------------------------------------
# Static file/structure checks
# ---------------------------------------------------------------------------

def test_project_godot_exists():
    p = os.path.join(PROJECT_DIR, "project.godot")
    assert os.path.isfile(p), f"Missing Godot project file at {p}"


def test_required_files_exist():
    required = [
        "scripts/FieldController.gd",
        "scripts/ProbeBody.gd",
        "scenes/GravityLab.tscn",
    ]
    for rel in required:
        full = os.path.join(PROJECT_DIR, rel)
        assert os.path.isfile(full), f"Missing required file: {full}"


def test_field_controller_declares_class_and_api():
    src = _read_text(os.path.join(PROJECT_DIR, "scripts/FieldController.gd"))
    assert re.search(r"^\s*class_name\s+FieldController\b", src, re.MULTILINE), (
        "scripts/FieldController.gd must declare `class_name FieldController`."
    )
    assert re.search(r"^\s*func\s+net_gravity_at\s*\(", src, re.MULTILINE), (
        "scripts/FieldController.gd must define a `func net_gravity_at(...)`."
    )


def test_scene_declares_expected_nodes():
    content = _read_text(os.path.join(PROJECT_DIR, "scenes/GravityLab.tscn"))
    assert re.search(r'\[node[^\]]*type="Node2D"[^\]]*\]', content), (
        "scenes/GravityLab.tscn must declare a Node2D root."
    )
    assert "scripts/FieldController.gd" in content, (
        "scenes/GravityLab.tscn must reference scripts/FieldController.gd."
    )
    area_nodes = re.findall(r'\[node\s+name="([^"]+)"[^\]]*type="Area2D"', content)
    assert len(area_nodes) == 6, (
        f"Expected exactly 6 Area2D nodes in GravityLab.tscn, found {len(area_nodes)}: {area_nodes}"
    )
    body_nodes = re.findall(r'\[node\s+name="([^"]+)"[^\]]*type="RigidBody2D"', content)
    assert len(body_nodes) == 1, (
        f"Expected exactly 1 RigidBody2D node in GravityLab.tscn, found {len(body_nodes)}: {body_nodes}"
    )


# ---------------------------------------------------------------------------
# Godot loads the project cleanly
# ---------------------------------------------------------------------------

def test_project_loads_without_errors():
    _reset_user_data()
    result = subprocess.run(
        ["godot", "--headless", "--path", PROJECT_DIR, "--quit"],
        capture_output=True,
        text=True,
        timeout=120,
        env=_godot_env(),
    )
    combined = (result.stdout or "") + (result.stderr or "")
    assert result.returncode == 0, (
        f"`godot --quit` exited with code {result.returncode}:\nstdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )
    forbidden = ["SCRIPT ERROR", "Parse Error", "Failed to load"]
    for marker in forbidden:
        assert marker not in combined, (
            f"Godot reported '{marker}' while loading the project:\n{combined}"
        )


# ---------------------------------------------------------------------------
# Headless harnesses
# ---------------------------------------------------------------------------

def test_struct_harness():
    _run_harness("test_harness_struct.tscn", "STRUCT_HARNESS_OK", timeout=180)


def test_probe_harness():
    _run_harness("test_harness_probe.tscn", "PROBE_HARNESS_OK", timeout=180)


def test_traj_harness():
    _run_harness("test_harness_traj.tscn", "TRAJ_HARNESS_OK", timeout=240)
