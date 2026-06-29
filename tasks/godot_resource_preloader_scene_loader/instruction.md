# Asynchronous Scene Loader (Godot 4)

Build an asynchronous scene loader in the Godot 4 project at `/home/user/myproject`.

## Task Requirements

- **Project Path**: `/home/user/myproject`.
- **Autoload Registration**:
  - `project.godot` must register an autoload named exactly `SceneLoader` pointing to `res://autoloads/SceneLoader.gd` (singleton form: `SceneLoader="*res://autoloads/SceneLoader.gd"`).
- **SceneLoader API**:
  - `res://autoloads/SceneLoader.gd` must `extends Node`, declare `class_name SceneLoader`, and expose:
    - Signals: `progress_updated(fraction)`, `load_completed(scene)`, `load_failed(reason)`.
    - Methods: `start_load(path: String) -> bool`, `cancel() -> void`, `is_loading() -> bool`.
- **SceneLoader Behaviour**:
  - Calling `start_load("res://scenes/HugeLevel.tscn")` should return `true`. A second call before the first finishes should return `false`.
  - During a successful load, at least one `progress_updated` signal must fire, and every emitted `fraction` must satisfy `0.0 <= fraction <= 1.0`.
  - On success, `load_completed` must fire exactly once, carrying a `PackedScene` whose instantiation produces a node tree with at least 50 `Node2D` descendants (counted recursively).
  - Calling `start_load("res://does/not/exist.tscn")` must cause `load_failed` to fire within 1 second. `load_completed` must not fire for that path, and afterwards `is_loading()` must return `false`.
  - After calling `cancel()`, `is_loading()` must return `false`, and a subsequent `start_load` of a valid path should return `true`.
- **Required Scenes**:
  - `res://scenes/HugeLevel.tscn` must exist and instantiate to a tree with at least 50 `Node2D` descendants.
  - `res://scenes/LoadingScreen.tscn` must exist with a `Control` root containing a `ProgressBar` and a `Label`. Its attached script must connect to the autoload's three signals.

## Test Harness

A test harness at `res://tests/run_tests.gd` is provided. When invoked as:
```bash
godot --headless --path . --script res://tests/run_tests.gd
```
from `/home/user/myproject`, it must exit with code `0` and print `ALL TESTS PASSED` on stdout. On any failure, the harness prints a line beginning with `FAIL:` and exits non-zero.
