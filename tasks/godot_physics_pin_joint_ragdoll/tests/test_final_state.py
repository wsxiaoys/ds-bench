import os
import re
import shutil
import subprocess

import pytest


PROJECT_DIR = "/home/user/ragdoll"
ZEALT_TESTS_DIR = os.path.join(PROJECT_DIR, "_zealt_tests")
HARNESS_SRC_DIR = "/tests"
HARNESS_FILES = [
    "test_harness_static.gd",
    "test_harness_static.tscn",
    "test_harness_runtime.gd",
    "test_harness_runtime.tscn",
    "test_harness_settle.gd",
    "test_harness_settle.tscn",
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
        "scenes/Ragdoll.tscn",
        "scripts/Ragdoll.gd",
    ]
    for rel in required:
        full = os.path.join(PROJECT_DIR, rel)
        assert os.path.isfile(full), f"Missing required file: {full}"


def test_ragdoll_script_declares_class_and_api():
    src = _read_text(os.path.join(PROJECT_DIR, "scripts/Ragdoll.gd"))
    assert re.search(r"^\s*class_name\s+Ragdoll\b", src, re.MULTILINE), (
        "scripts/Ragdoll.gd must declare `class_name Ragdoll`."
    )
    required_methods = [
        "apply_impulse_to",
        "freeze_all",
        "get_part",
        "get_average_position",
    ]
    for m in required_methods:
        pattern = re.compile(r"^\s*func\s+" + re.escape(m) + r"\s*\(", re.MULTILINE)
        assert pattern.search(src), (
            f"scripts/Ragdoll.gd must define a `func {m}(...)`."
        )
    assert re.search(r"^\s*signal\s+ragdoll_collapsed\b", src, re.MULTILINE), (
        "scripts/Ragdoll.gd must declare `signal ragdoll_collapsed(...)`."
    )


def test_ragdoll_scene_structure():
    content = _read_text(os.path.join(PROJECT_DIR, "scenes/Ragdoll.tscn"))

    # Root is Node2D and references scripts/Ragdoll.gd.
    assert re.search(r'\[node[^\]]*type="Node2D"[^\]]*\]', content), (
        "scenes/Ragdoll.tscn must declare a Node2D root."
    )
    assert "scripts/Ragdoll.gd" in content, (
        "scenes/Ragdoll.tscn must reference scripts/Ragdoll.gd via ext_resource."
    )

    # Exactly 6 RigidBody2D nodes.
    body_nodes = re.findall(r'\[node\s+name="([^"]+)"[^\]]*type="RigidBody2D"', content)
    assert len(body_nodes) == 6, (
        f"Expected exactly 6 RigidBody2D nodes in Ragdoll.tscn, found {len(body_nodes)}: {body_nodes}"
    )
    required_names = {"Head", "Torso", "LeftArm", "RightArm", "LeftLeg", "RightLeg"}
    assert set(body_nodes) == required_names, (
        f"RigidBody2D names mismatch. Expected {sorted(required_names)}, got {sorted(body_nodes)}"
    )

    # Exactly 5 PinJoint2D nodes.
    pin_nodes = re.findall(r'\[node\s+name="([^"]+)"[^\]]*type="PinJoint2D"', content)
    assert len(pin_nodes) == 5, (
        f"Expected exactly 5 PinJoint2D nodes in Ragdoll.tscn, found {len(pin_nodes)}: {pin_nodes}"
    )


# ---------------------------------------------------------------------------
# Godot loads project cleanly
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
# Static structure / PinJoint2D wiring via headless Godot
# ---------------------------------------------------------------------------

def test_static_harness():
    _reset_user_data()
    result = subprocess.run(
        [
            "godot",
            "--headless",
            "--path",
            PROJECT_DIR,
            "res://_zealt_tests/test_harness_static.tscn",
        ],
        capture_output=True,
        text=True,
        timeout=180,
        env=_godot_env(),
    )
    combined = (result.stdout or "") + (result.stderr or "")
    assert result.returncode == 0, (
        f"Static harness exited with code {result.returncode}:\n{combined}"
    )
    assert "STATIC_HARNESS_OK" in result.stdout, (
        f"Static harness did not print STATIC_HARNESS_OK. Output:\n{combined}"
    )


# ---------------------------------------------------------------------------
# Runtime behavior: apply_impulse_to + freeze_all
# ---------------------------------------------------------------------------

def test_runtime_harness():
    _reset_user_data()
    result = subprocess.run(
        [
            "godot",
            "--headless",
            "--path",
            PROJECT_DIR,
            "res://_zealt_tests/test_harness_runtime.tscn",
        ],
        capture_output=True,
        text=True,
        timeout=180,
        env=_godot_env(),
    )
    combined = (result.stdout or "") + (result.stderr or "")
    assert result.returncode == 0, (
        f"Runtime harness exited with code {result.returncode}:\n{combined}"
    )
    assert "RUNTIME_HARNESS_OK" in result.stdout, (
        f"Runtime harness did not print RUNTIME_HARNESS_OK. Output:\n{combined}"
    )


# ---------------------------------------------------------------------------
# Settle + collapse signal
# ---------------------------------------------------------------------------

def test_settle_harness():
    _reset_user_data()
    result = subprocess.run(
        [
            "godot",
            "--headless",
            "--path",
            PROJECT_DIR,
            "res://_zealt_tests/test_harness_settle.tscn",
        ],
        capture_output=True,
        text=True,
        timeout=240,
        env=_godot_env(),
    )
    combined = (result.stdout or "") + (result.stderr or "")
    assert result.returncode == 0, (
        f"Settle harness exited with code {result.returncode}:\n{combined}"
    )
    assert "SETTLE_HARNESS_OK" in result.stdout, (
        f"Settle harness did not print SETTLE_HARNESS_OK. Output:\n{combined}"
    )
