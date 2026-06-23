import os
import re
import shutil
import subprocess
from pathlib import Path

import pytest


PROJECT_DIR = "/home/user/coin_collector"
ZEALT_TESTS_DIR = os.path.join(PROJECT_DIR, "_zealt_tests")
HARNESS_SRC_DIR = "/tests"
HARNESS_FILES = [
    "test_harness_runtime.gd",
    "test_harness_runtime.tscn",
    "test_harness_persistence_write.gd",
    "test_harness_persistence_write.tscn",
    "test_harness_persistence_read.gd",
    "test_harness_persistence_read.tscn",
]

XDG_DATA_HOME = "/tmp/godot_test_xdg"


def _godot_env() -> dict:
    env = os.environ.copy()
    env["XDG_DATA_HOME"] = XDG_DATA_HOME
    # Ensure DISPLAY is not set so headless is forced.
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
        # Ignore Godot's auto-generated import cache and the harness folder.
        rel = os.path.relpath(root, PROJECT_DIR)
        if rel.startswith(".godot") or rel.startswith("_zealt_tests"):
            continue
        for f in files:
            if f.endswith(".gd"):
                parts.append(_read_text(os.path.join(root, f)))
    return "\n".join(parts)


def _all_tscn_sources() -> str:
    parts = []
    for root, _dirs, files in os.walk(PROJECT_DIR):
        rel = os.path.relpath(root, PROJECT_DIR)
        if rel.startswith(".godot") or rel.startswith("_zealt_tests"):
            continue
        for f in files:
            if f.endswith(".tscn"):
                parts.append(_read_text(os.path.join(root, f)))
    return "\n".join(parts)


@pytest.fixture(scope="module", autouse=True)
def _setup_module():
    _install_harnesses()
    yield
    # Best-effort cleanup of harness directory.
    shutil.rmtree(ZEALT_TESTS_DIR, ignore_errors=True)


# ---------------------------------------------------------------------------
# Static structure checks
# ---------------------------------------------------------------------------

def test_project_godot_exists():
    p = os.path.join(PROJECT_DIR, "project.godot")
    assert os.path.isfile(p), f"Missing Godot project file at {p}"


def test_required_files_exist():
    required = [
        "autoloads/Inventory.gd",
        "scenes/Player.tscn",
        "scenes/Coin.tscn",
        "scenes/HUD.tscn",
        "scenes/Main.tscn",
    ]
    for rel in required:
        full = os.path.join(PROJECT_DIR, rel)
        assert os.path.isfile(full), f"Missing required file: {full}"


def test_autoload_registered_in_project_godot():
    content = _read_text(os.path.join(PROJECT_DIR, "project.godot"))
    pattern = re.compile(
        r'^Inventory\s*=\s*"\*res://autoloads/Inventory\.gd"\s*$',
        re.MULTILINE,
    )
    assert pattern.search(content), (
        "project.godot must register `Inventory=\"*res://autoloads/Inventory.gd\"` "
        "in the [autoload] section."
    )


def test_player_scene_is_character_body_2d():
    content = _read_text(os.path.join(PROJECT_DIR, "scenes/Player.tscn"))
    assert re.search(r'type="CharacterBody2D"', content), (
        "scenes/Player.tscn must declare a node of type CharacterBody2D."
    )
    # Must reference at least one script resource.
    assert ("ExtResource" in content and ".gd" in content) or "script = " in content, (
        "scenes/Player.tscn must attach a GDScript."
    )


def test_coin_scene_is_area2d():
    content = _read_text(os.path.join(PROJECT_DIR, "scenes/Coin.tscn"))
    assert re.search(r'type="Area2D"', content), (
        "scenes/Coin.tscn must declare a node of type Area2D."
    )
    assert ("ExtResource" in content and ".gd" in content) or "script = " in content, (
        "scenes/Coin.tscn must attach a GDScript."
    )


def test_hud_scene_is_canvas_layer():
    content = _read_text(os.path.join(PROJECT_DIR, "scenes/HUD.tscn"))
    assert re.search(r'type="CanvasLayer"', content), (
        "scenes/HUD.tscn must declare a node of type CanvasLayer."
    )


def test_physics_process_calls_move_and_slide():
    src = _all_gd_sources()
    assert re.search(r"\b_physics_process\b", src), (
        "Expected at least one script to define _physics_process."
    )
    assert re.search(r"\bmove_and_slide\s*\(", src), (
        "Expected at least one script to call move_and_slide()."
    )


def test_coin_handler_uses_inventory_and_queue_free():
    src = _all_gd_sources()
    # We don't enforce a specific function name; only that some script uses both APIs.
    assert "Inventory.add_coin" in src or "Inventory.call(\"add_coin\"" in src, (
        "Expected some script to call Inventory.add_coin() (e.g., on body_entered)."
    )
    assert "queue_free" in src, (
        "Expected some script to call queue_free() (e.g., to remove the collected coin)."
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
# Runtime behavior (Inventory + HUD)
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
    assert "HARNESS_OK" in result.stdout, (
        f"Runtime harness did not print HARNESS_OK. Output:\n{combined}"
    )


# ---------------------------------------------------------------------------
# Persistence across restarts
# ---------------------------------------------------------------------------

def test_persistence_round_trip():
    _reset_user_data()

    write_res = subprocess.run(
        [
            "godot",
            "--headless",
            "--path",
            PROJECT_DIR,
            "res://_zealt_tests/test_harness_persistence_write.tscn",
        ],
        capture_output=True,
        text=True,
        timeout=180,
        env=_godot_env(),
    )
    write_out = (write_res.stdout or "") + (write_res.stderr or "")
    assert write_res.returncode == 0, (
        f"Persistence write harness failed (code {write_res.returncode}):\n{write_out}"
    )
    assert "PERSIST_WRITE_OK count=3" in write_res.stdout, (
        f"Persistence write harness did not report success. Output:\n{write_out}"
    )

    # Confirm save.json actually exists somewhere under the godot user data dir.
    save_files = list(Path(XDG_DATA_HOME).rglob("save.json"))
    assert save_files, (
        f"No save.json found under {XDG_DATA_HOME} after write pass; "
        "Inventory.save() must persist to user://save.json."
    )

    read_res = subprocess.run(
        [
            "godot",
            "--headless",
            "--path",
            PROJECT_DIR,
            "res://_zealt_tests/test_harness_persistence_read.tscn",
        ],
        capture_output=True,
        text=True,
        timeout=180,
        env=_godot_env(),
    )
    read_out = (read_res.stdout or "") + (read_res.stderr or "")
    assert read_res.returncode == 0, (
        f"Persistence read harness failed (code {read_res.returncode}):\n{read_out}"
    )
    assert "PERSIST_READ_OK count=3" in read_res.stdout, (
        f"Persistence read harness did not report count=3. Output:\n{read_out}"
    )
