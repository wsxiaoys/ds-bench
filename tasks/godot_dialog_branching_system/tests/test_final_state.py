import os
import re
import shutil
import subprocess

import pytest


PROJECT_DIR = "/home/user/dialog_branching_system"
ZEALT_TESTS_DIR = os.path.join(PROJECT_DIR, "_zealt_tests")
HARNESS_SRC_DIR = "/tests"
HARNESS_FILES = [
    "test_harness_dialog.gd",
    "test_harness_dialog.tscn",
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
# Static file existence checks.
# ---------------------------------------------------------------------------

def test_project_godot_exists():
    p = os.path.join(PROJECT_DIR, "project.godot")
    assert os.path.isfile(p), f"Missing Godot project file at {p}"


def test_required_files_exist():
    required = [
        "scripts/DialogNode.gd",
        "scripts/DialogChoice.gd",
        "scripts/DialogTree.gd",
        "scripts/DialogPlayer.gd",
        "scenes/DialogUI.tscn",
        "resources/dialogs/intro.tres",
    ]
    for rel in required:
        full = os.path.join(PROJECT_DIR, rel)
        assert os.path.isfile(full), f"Missing required file: {full}"


# ---------------------------------------------------------------------------
# Source structure checks (class_name, extends, exports, signals, methods).
# ---------------------------------------------------------------------------

def _src(rel: str) -> str:
    return _read_text(os.path.join(PROJECT_DIR, rel))


def test_dialog_node_script_declares_resource_with_exports():
    src = _src("scripts/DialogNode.gd")
    assert re.search(r"^\s*class_name\s+DialogNode\b", src, re.MULTILINE), (
        "DialogNode.gd must declare `class_name DialogNode`."
    )
    assert re.search(r"^\s*extends\s+Resource\b", src, re.MULTILINE), (
        "DialogNode.gd must `extends Resource`."
    )
    for prop, type_re in [
        ("id", r"StringName"),
        ("speaker", r"String"),
        ("text", r"String"),
        ("choices", r"Array\s*\[\s*DialogChoice\s*\]"),
        ("next_id", r"StringName"),
    ]:
        pattern = rf"@export\s+var\s+{prop}\s*:\s*{type_re}"
        assert re.search(pattern, src), (
            f"DialogNode.gd must export `{prop}` typed as {type_re}."
        )


def test_dialog_choice_script_declares_resource_with_exports():
    src = _src("scripts/DialogChoice.gd")
    assert re.search(r"^\s*class_name\s+DialogChoice\b", src, re.MULTILINE), (
        "DialogChoice.gd must declare `class_name DialogChoice`."
    )
    assert re.search(r"^\s*extends\s+Resource\b", src, re.MULTILINE), (
        "DialogChoice.gd must `extends Resource`."
    )
    for prop, type_re in [
        ("label", r"String"),
        ("next_id", r"StringName"),
        ("condition_flag", r"StringName"),
    ]:
        pattern = rf"@export\s+var\s+{prop}\s*:\s*{type_re}"
        assert re.search(pattern, src), (
            f"DialogChoice.gd must export `{prop}` typed as {type_re}."
        )


def test_dialog_tree_script_declares_resource_with_exports_and_get_node():
    src = _src("scripts/DialogTree.gd")
    assert re.search(r"^\s*class_name\s+DialogTree\b", src, re.MULTILINE), (
        "DialogTree.gd must declare `class_name DialogTree`."
    )
    assert re.search(r"^\s*extends\s+Resource\b", src, re.MULTILINE), (
        "DialogTree.gd must `extends Resource`."
    )
    assert re.search(r"@export\s+var\s+nodes\s*:\s*Array\s*\[\s*DialogNode\s*\]", src), (
        "DialogTree.gd must export `nodes: Array[DialogNode]`."
    )
    assert re.search(r"@export\s+var\s+start_id\s*:\s*StringName", src), (
        "DialogTree.gd must export `start_id: StringName`."
    )
    assert re.search(r"\bfunc\s+get_node\s*\(", src), (
        "DialogTree.gd must define a `get_node` method."
    )


def test_dialog_player_script_has_signals_and_methods():
    src = _src("scripts/DialogPlayer.gd")
    assert re.search(r"^\s*class_name\s+DialogPlayer\b", src, re.MULTILINE), (
        "DialogPlayer.gd must declare `class_name DialogPlayer`."
    )
    assert re.search(r"@export\s+var\s+tree\s*:\s*DialogTree", src), (
        "DialogPlayer.gd must export `tree: DialogTree`."
    )
    for sig in ["line_shown", "dialog_finished"]:
        assert re.search(rf"^\s*signal\s+{sig}\b", src, re.MULTILINE), (
            f"DialogPlayer.gd must declare `signal {sig}`."
        )
    for method in ["start", "advance", "set_flag", "has_flag"]:
        assert re.search(rf"\bfunc\s+{method}\s*\(", src), (
            f"DialogPlayer.gd must define `func {method}(...)`."
        )


def test_dialog_ui_scene_has_required_controls():
    src = _src("scenes/DialogUI.tscn")
    assert re.search(r'type="RichTextLabel"', src), (
        "scenes/DialogUI.tscn must contain a RichTextLabel node."
    )
    assert re.search(r'type="Label"', src), (
        "scenes/DialogUI.tscn must contain a Label node (for the speaker)."
    )
    assert re.search(r'type="VBoxContainer"', src), (
        "scenes/DialogUI.tscn must contain a VBoxContainer (for choice buttons)."
    )


# ---------------------------------------------------------------------------
# Godot loads the project cleanly.
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
        f"`godot --quit` exited with code {result.returncode}:\n"
        f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )
    forbidden = ["SCRIPT ERROR", "Parse Error", "Failed to load"]
    for marker in forbidden:
        assert marker not in combined, (
            f"Godot reported '{marker}' while loading the project:\n{combined}"
        )


# ---------------------------------------------------------------------------
# Runtime harness: validates intro.tres + DialogPlayer behavior.
# ---------------------------------------------------------------------------

def test_runtime_harness():
    _reset_user_data()
    result = subprocess.run(
        [
            "godot",
            "--headless",
            "--path",
            PROJECT_DIR,
            "res://_zealt_tests/test_harness_dialog.tscn",
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
    assert "HARNESS_OK" in result.stdout, (
        f"Runtime harness did not print HARNESS_OK. Output:\n{combined}"
    )
