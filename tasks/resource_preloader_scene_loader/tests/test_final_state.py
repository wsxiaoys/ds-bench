import os
import re
import shutil
import subprocess

PROJECT_DIR = "/home/user/myproject"


def _run_godot(args, timeout=180):
    return subprocess.run(
        ["godot", *args],
        capture_output=True,
        text=True,
        cwd=PROJECT_DIR,
        timeout=timeout,
    )


def test_godot_binary_available():
    assert shutil.which("godot") is not None, "godot binary missing from PATH."


def test_project_godot_registers_sceneloader_autoload():
    project_file = os.path.join(PROJECT_DIR, "project.godot")
    assert os.path.isfile(project_file), (
        f"project.godot not found at {project_file}."
    )
    with open(project_file, "r", encoding="utf-8") as f:
        content = f.read()

    autoload_section_match = re.search(
        r"\[autoload\](.*?)(?=^\[|\Z)", content, flags=re.DOTALL | re.MULTILINE
    )
    assert autoload_section_match, (
        "project.godot is missing an [autoload] section that registers SceneLoader."
    )
    autoload_section = autoload_section_match.group(1)
    assert re.search(
        r'^\s*SceneLoader\s*=\s*"\*res://autoloads/SceneLoader\.gd"\s*$',
        autoload_section,
        flags=re.MULTILINE,
    ), (
        "Expected `SceneLoader=\"*res://autoloads/SceneLoader.gd\"` (with leading `*`) "
        "in the [autoload] section of project.godot."
    )


def test_sceneloader_script_exists_with_expected_api():
    script_path = os.path.join(PROJECT_DIR, "autoloads", "SceneLoader.gd")
    assert os.path.isfile(script_path), (
        f"Autoload script not found at {script_path}."
    )
    with open(script_path, "r", encoding="utf-8") as f:
        source = f.read()

    assert re.search(r"^\s*class_name\s+SceneLoader\b", source, flags=re.MULTILINE), (
        "autoloads/SceneLoader.gd must declare `class_name SceneLoader`."
    )
    assert re.search(r"^\s*extends\s+Node\b", source, flags=re.MULTILINE), (
        "autoloads/SceneLoader.gd must `extends Node`."
    )
    assert re.search(r"^\s*signal\s+progress_updated\b", source, flags=re.MULTILINE), (
        "Missing `signal progress_updated` declaration."
    )
    assert re.search(r"^\s*signal\s+load_completed\b", source, flags=re.MULTILINE), (
        "Missing `signal load_completed` declaration."
    )
    assert re.search(r"^\s*signal\s+load_failed\b", source, flags=re.MULTILINE), (
        "Missing `signal load_failed` declaration."
    )
    assert re.search(r"\bfunc\s+start_load\s*\(", source), (
        "Missing `func start_load(...)` method."
    )
    assert re.search(r"\bfunc\s+cancel\s*\(", source), (
        "Missing `func cancel(...)` method."
    )
    assert re.search(r"\bfunc\s+is_loading\s*\(", source), (
        "Missing `func is_loading(...)` method."
    )


def test_required_scene_files_exist():
    huge = os.path.join(PROJECT_DIR, "scenes", "HugeLevel.tscn")
    loading = os.path.join(PROJECT_DIR, "scenes", "LoadingScreen.tscn")
    assert os.path.isfile(huge), f"Expected scene file at {huge}."
    assert os.path.isfile(loading), f"Expected scene file at {loading}."


def test_test_harness_script_exists():
    harness = os.path.join(PROJECT_DIR, "tests", "run_tests.gd")
    assert os.path.isfile(harness), (
        f"Test harness GDScript not found at {harness}."
    )


def test_import_godot_project():
    # Wipe any stale import cache so resources are re-imported deterministically.
    import_dir = os.path.join(PROJECT_DIR, ".godot")
    if os.path.isdir(import_dir):
        shutil.rmtree(import_dir)

    result = _run_godot(["--headless", "--path", ".", "--import"], timeout=240)
    assert result.returncode == 0, (
        "Failed to import the Godot project headlessly.\n"
        f"stdout: {result.stdout}\nstderr: {result.stderr}"
    )


def test_run_godot_harness_passes():
    result = _run_godot(
        ["--headless", "--path", ".", "--script", "res://tests/run_tests.gd"],
        timeout=240,
    )
    combined = result.stdout + "\n" + result.stderr
    assert result.returncode == 0, (
        "Godot test harness exited with a non-zero status.\n"
        f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )
    assert "ALL TESTS PASSED" in combined, (
        "Expected the harness to print `ALL TESTS PASSED` on success.\n"
        f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )
    assert not re.search(r"(?m)^FAIL:", combined), (
        "Harness printed a FAIL: line, indicating an assertion failed.\n"
        f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )
