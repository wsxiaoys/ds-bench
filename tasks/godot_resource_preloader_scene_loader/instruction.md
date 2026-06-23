# Asynchronous Scene Loader (Godot 4)

Build an asynchronous scene loader in the Godot 4 project at `/home/user/myproject`.

## Acceptance Criteria

- Project path: `/home/user/myproject`.
- `project.godot` registers an autoload named exactly `SceneLoader` pointing to `res://autoloads/SceneLoader.gd` (singleton form: `SceneLoader="*res://autoloads/SceneLoader.gd"`).
- `res://autoloads/SceneLoader.gd` `extends Node`, declares `class_name SceneLoader`, and exposes:
  - Signals: `progress_updated(fraction)`, `load_completed(scene)`, `load_failed(reason)`.
  - Methods: `start_load(path: String) -> bool`, `cancel() -> void`, `is_loading() -> bool`.
- Behaviour:
  - `start_load("res://scenes/HugeLevel.tscn")` returns `true`; a second call before the first finishes returns `false`.
  - During a successful load at least one `progress_updated` signal fires; every emitted `fraction` satisfies `0.0 <= fraction <= 1.0`.
  - On success, `load_completed` fires exactly once carrying a `PackedScene` whose instantiation produces a node tree with at least 50 `Node2D` descendants (counted recursively).
  - `start_load("res://does/not/exist.tscn")` causes `load_failed` to fire within 1 second; `load_completed` must not fire for that path; afterwards `is_loading()` returns `false`.
  - After `cancel()`, `is_loading()` returns `false`, and a subsequent `start_load` of a valid path returns `true`.
- `res://scenes/HugeLevel.tscn` exists and instantiates to a tree with at least 50 `Node2D` descendants.
- `res://scenes/LoadingScreen.tscn` exists with a `Control` root containing a `ProgressBar` and a `Label`; its attached script connects to the autoload's three signals.
- Test harness at `res://tests/run_tests.gd` must, when invoked as `godot --headless --path . --script res://tests/run_tests.gd` from `/home/user/myproject`, exit with code `0` and print `ALL TESTS PASSED` on stdout. On any failure the harness prints a line beginning with `FAIL:` and exits non-zero.
