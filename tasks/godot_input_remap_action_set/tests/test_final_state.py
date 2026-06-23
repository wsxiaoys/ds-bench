import os
import re
import shutil
import subprocess

import pytest


PROJECT_DIR = "/home/user/input_remap"
ZEALT_TESTS_DIR = os.path.join(PROJECT_DIR, "_zealt_tests")
HARNESS_SRC_DIR = "/tests"
HARNESS_FILES = [
    "test_harness_actions.gd",
    "test_harness_actions.tscn",
    "test_harness_persistence.gd",
    "test_harness_persistence.tscn",
    "test_harness_remap_button.gd",
    "test_harness_remap_button.tscn",
]

XDG_DATA_HOME = "/tmp/godot_test_xdg_input_remap"

REQUIRED_ACTIONS = [
    "move_up",
    "move_down",
    "move_left",
    "move_right",
    "interact",
    "jump",
]


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


def _all_gd_sources() -> str:
    parts = []
    for root, _dirs, files in os.walk(PROJECT_DIR):
        rel = os.path.relpath(root, PROJECT_DIR)
        if rel.startswith(".godot") or rel.startswith("_zealt_tests"):
            continue
        for f in files:
            if f.endswith(".gd"):
                parts.append(_read_text(os.path.join(root, f)))
    return "\n".join(parts)


@pytest.fixture(scope="module", autouse=True)
def _setup_module():
    _install_harnesses()
    yield
    shutil.rmtree(ZEALT_TESTS_DIR, ignore_errors=True)


# ---------------------------------------------------------------------------
# Static structure checks
# ---------------------------------------------------------------------------

def test_project_godot_exists():
    p = os.path.join(PROJECT_DIR, "project.godot")
    assert os.path.isfile(p), f"Missing Godot project file at {p}"


def test_required_files_exist():
    required = [
        "autoloads/InputRemapper.gd",
        "scenes/RemapButton.tscn",
    ]
    for rel in required:
        full = os.path.join(PROJECT_DIR, rel)
        assert os.path.isfile(full), f"Missing required file: {full}"


def test_autoload_registered_in_project_godot():
    content = _read_text(os.path.join(PROJECT_DIR, "project.godot"))
    pattern = re.compile(
        r'^InputRemapper\s*=\s*"\*res://autoloads/InputRemapper\.gd"\s*$',
        re.MULTILINE,
    )
    assert pattern.search(content), (
        "project.godot must register "
        '`InputRemapper="*res://autoloads/InputRemapper.gd"` in the [autoload] section.'
    )


def test_project_godot_declares_all_actions():
    content = _read_text(os.path.join(PROJECT_DIR, "project.godot"))
    assert re.search(r"^\[input\]\s*$", content, re.MULTILINE), (
        "project.godot must contain an [input] section declaring the default actions."
    )
    for action in REQUIRED_ACTIONS:
        # Each action is declared as `<action>={ ... }` somewhere in the file.
        pattern = re.compile(r"^" + re.escape(action) + r"\s*=", re.MULTILINE)
        assert pattern.search(content), (
            f"project.godot must declare a default `{action}` action under [input]."
        )


def test_remap_button_scene_uses_control_root():
    content = _read_text(os.path.join(PROJECT_DIR, "scenes/RemapButton.tscn"))
    # Acceptable root node types: Control or any Control-derived (Button, Label, etc.).
    # Most natural choice is Button; allow other Control-derived types.
    root_type_match = re.search(
        r'\[node\s+name="[^"]+"\s+type="([^"]+)"',
        content,
    )
    assert root_type_match, (
        "scenes/RemapButton.tscn must declare a root [node] with a type=..."
    )
    root_type = root_type_match.group(1)
    # Accept common Control-derived types.
    allowed_roots = {
        "Control",
        "Button",
        "BaseButton",
        "TextureButton",
        "MenuButton",
        "OptionButton",
        "Label",
        "Panel",
        "PanelContainer",
        "HBoxContainer",
        "VBoxContainer",
        "MarginContainer",
        "CenterContainer",
    }
    assert root_type in allowed_roots, (
        f"scenes/RemapButton.tscn root type `{root_type}` is not a recognized Control-derived type."
    )

    assert ("ExtResource" in content and ".gd" in content) or "script = " in content, (
        "scenes/RemapButton.tscn must attach a GDScript."
    )


def test_remap_button_script_declares_action_name_export():
    src = _read_text(os.path.join(PROJECT_DIR, "scenes/RemapButton.tscn"))
    # Extract the referenced script path from the scene file.
    m = re.search(r'\[ext_resource[^\]]*type="Script"[^\]]*path="(res://[^"]+\.gd)"', src)
    assert m, "scenes/RemapButton.tscn must reference a GDScript via ext_resource."
    script_res_path = m.group(1)
    script_fs_path = os.path.join(PROJECT_DIR, script_res_path.removeprefix("res://"))
    assert os.path.isfile(script_fs_path), f"Referenced script missing on disk: {script_fs_path}"

    script_content = _read_text(script_fs_path)
    # Must declare an exported `action_name` with StringName type.
    pattern = re.compile(
        r"@export\s+var\s+action_name\s*:\s*StringName",
    )
    assert pattern.search(script_content), (
        "RemapButton script must declare `@export var action_name: StringName`."
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
        f"`godot --quit` exited with code {result.returncode}:\n"
        f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )
    forbidden = ["SCRIPT ERROR", "Parse Error", "Failed to load"]
    for marker in forbidden:
        assert marker not in combined, (
            f"Godot reported '{marker}' while loading the project:\n{combined}"
        )


# ---------------------------------------------------------------------------
# Runtime harnesses
# ---------------------------------------------------------------------------

def test_actions_harness():
    _reset_user_data()
    result = subprocess.run(
        [
            "godot",
            "--headless",
            "--path",
            PROJECT_DIR,
            "res://_zealt_tests/test_harness_actions.tscn",
        ],
        capture_output=True,
        text=True,
        timeout=180,
        env=_godot_env(),
    )
    combined = (result.stdout or "") + (result.stderr or "")
    assert result.returncode == 0, (
        f"Actions harness exited with code {result.returncode}:\n{combined}"
    )
    assert "ACTIONS_OK" in result.stdout, (
        f"Actions harness did not print ACTIONS_OK. Output:\n{combined}"
    )


def test_persistence_harness():
    _reset_user_data()
    result = subprocess.run(
        [
            "godot",
            "--headless",
            "--path",
            PROJECT_DIR,
            "res://_zealt_tests/test_harness_persistence.tscn",
        ],
        capture_output=True,
        text=True,
        timeout=180,
        env=_godot_env(),
    )
    combined = (result.stdout or "") + (result.stderr or "")
    assert result.returncode == 0, (
        f"Persistence harness exited with code {result.returncode}:\n{combined}"
    )
    assert "PERSIST_OK" in result.stdout, (
        f"Persistence harness did not print PERSIST_OK. Output:\n{combined}"
    )


def test_remap_button_harness():
    _reset_user_data()
    result = subprocess.run(
        [
            "godot",
            "--headless",
            "--path",
            PROJECT_DIR,
            "res://_zealt_tests/test_harness_remap_button.tscn",
        ],
        capture_output=True,
        text=True,
        timeout=180,
        env=_godot_env(),
    )
    combined = (result.stdout or "") + (result.stderr or "")
    assert result.returncode == 0, (
        f"RemapButton harness exited with code {result.returncode}:\n{combined}"
    )
    assert "REMAP_BUTTON_OK" in result.stdout, (
        f"RemapButton harness did not print REMAP_BUTTON_OK. Output:\n{combined}"
    )
