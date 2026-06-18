import os
import shutil
import subprocess
import textwrap

import pytest

PROJECT_DIR = "/home/user/myproject"
LOG_FILE = os.path.join(PROJECT_DIR, "verify_result.log")
HARNESS_PATH = os.path.join(PROJECT_DIR, "verify_harness.gd")

HARNESS_SRC = textwrap.dedent(
    """
    extends SceneTree

    const LOG_PATH := "res://verify_result.log"

    var _errors: Array[String] = []

    func _initialize() -> void:
        _run.call_deferred()

    func _fail(msg: String) -> void:
        _errors.append(msg)
        push_error(msg)

    func _write_and_quit(success: bool) -> void:
        var f := FileAccess.open(LOG_PATH, FileAccess.WRITE)
        if f == null:
            push_error("Could not open log file for writing")
        else:
            if success and _errors.is_empty():
                f.store_line("VERIFY_OK")
            else:
                f.store_line("VERIFY_FAIL: " + "; ".join(_errors))
            f.close()
        quit(0 if success and _errors.is_empty() else 1)

    func _color_close(a: Color, b: Color) -> bool:
        var eps := 0.02
        return abs(a.r - b.r) < eps and abs(a.g - b.g) < eps and abs(a.b - b.b) < eps and abs(a.a - b.a) < eps

    func _find_color_rect(node: Node) -> ColorRect:
        for c in node.get_children():
            if c is ColorRect:
                return c
        return null

    func _run() -> void:
        # 1. EnemyStats.gd checks
        var stats_script := load("res://scripts/EnemyStats.gd")
        if stats_script == null:
            _fail("scripts/EnemyStats.gd missing or failed to load")
            _write_and_quit(false)
            return

        var src_file := FileAccess.open("res://scripts/EnemyStats.gd", FileAccess.READ)
        if src_file == null:
            _fail("Cannot read EnemyStats.gd source")
        else:
            var src := src_file.get_as_text()
            src_file.close()
            if not src.contains("class_name EnemyStats"):
                _fail("EnemyStats.gd missing `class_name EnemyStats`")
            if not src.contains("extends Resource"):
                _fail("EnemyStats.gd missing `extends Resource`")

        var inst = stats_script.new()
        if inst == null or not (inst is Resource):
            _fail("EnemyStats does not extend Resource")
            _write_and_quit(false)
            return

        var required := {
            "name": TYPE_STRING,
            "max_health": TYPE_INT,
            "speed": TYPE_FLOAT,
            "damage": TYPE_INT,
            "color": TYPE_COLOR,
        }
        var props = inst.get_property_list()
        var seen := {}
        for p in props:
            if required.has(p.name):
                seen[p.name] = p.type
        for k in required:
            if not seen.has(k):
                _fail("EnemyStats missing @export property: %s" % k)
            elif seen[k] != required[k]:
                _fail("EnemyStats property %s has type %d, expected %d" % [k, seen[k], required[k]])

        # 2. Load .tres files
        var paths := [
            "res://resources/enemies/goblin.tres",
            "res://resources/enemies/orc.tres",
            "res://resources/enemies/dragon.tres",
        ]
        var loaded: Array = []
        for path in paths:
            if not ResourceLoader.exists(path):
                _fail("Resource file does not exist: %s" % path)
                continue
            var res = load(path)
            if res == null:
                _fail("Failed to load %s" % path)
                continue
            if res.get_script() != stats_script:
                _fail("%s is not an EnemyStats resource" % path)
                continue
            loaded.append(res)

        if loaded.size() != 3:
            _write_and_quit(false)
            return

        # Pairwise distinct on name, max_health, color
        for i in range(loaded.size()):
            for j in range(i + 1, loaded.size()):
                var a = loaded[i]
                var b = loaded[j]
                if a.name == b.name:
                    _fail("Duplicate name between %s and %s" % [paths[i], paths[j]])
                if a.max_health == b.max_health:
                    _fail("Duplicate max_health between %s and %s" % [paths[i], paths[j]])
                if a.color == b.color:
                    _fail("Duplicate color between %s and %s" % [paths[i], paths[j]])

        # 3. Spawner
        if not ResourceLoader.exists("res://scenes/Spawner.tscn"):
            _fail("scenes/Spawner.tscn missing")
            _write_and_quit(false)
            return
        var spawner_packed = load("res://scenes/Spawner.tscn")
        if spawner_packed == null:
            _fail("Failed to load Spawner.tscn")
            _write_and_quit(false)
            return
        var spawner = spawner_packed.instantiate()
        if spawner == null:
            _fail("Failed to instantiate Spawner")
            _write_and_quit(false)
            return

        # Build typed Array[EnemyStats] without referencing class_name at parse time
        var typed_arr := Array([], TYPE_OBJECT, "Resource", stats_script)
        for r in loaded:
            typed_arr.append(r)

        # Assign before adding to tree so _ready uses the assigned value
        spawner.set("enemy_types", typed_arr)
        root.add_child(spawner)
        await process_frame

        var children = spawner.get_children()
        if children.size() != 3:
            _fail("Expected 3 enemy children after _ready, got %d" % children.size())

        for child in children:
            if not child.has_method("take_damage"):
                _fail("Spawned enemy is missing take_damage(amount)")

        if children.size() >= 1:
            var first = children[0]
            var color_rect := _find_color_rect(first)
            if color_rect == null:
                _fail("First spawned enemy has no ColorRect child")
            else:
                var expected_color: Color = loaded[0].color
                if not _color_close(color_rect.color, expected_color):
                    _fail("First enemy ColorRect.color %s != goblin.color %s" % [str(color_rect.color), str(expected_color)])
            var ch_val = first.get("current_health")
            if ch_val == null:
                _fail("First spawned enemy missing current_health property")
            elif int(ch_val) != int(loaded[0].max_health):
                _fail("First enemy current_health=%s, expected %s" % [str(ch_val), str(loaded[0].max_health)])

        # 4. take_damage_all
        if not spawner.has_method("take_damage_all"):
            _fail("Spawner is missing take_damage_all(amount)")
        else:
            spawner.take_damage_all(9999)
            # Two frames to be safe: queue_free clears next idle frame
            await process_frame
            await process_frame
            var count_after = spawner.get_child_count()
            if count_after != 0:
                _fail("Expected 0 children after take_damage_all, got %d" % count_after)

        _write_and_quit(_errors.is_empty())
    """
).strip() + "\n"


def _run_godot(args, timeout=180):
    return subprocess.run(
        args,
        capture_output=True,
        text=True,
        timeout=timeout,
        cwd=PROJECT_DIR,
    )


@pytest.fixture(scope="module")
def verify_run():
    assert shutil.which("godot") is not None, "godot binary not found in PATH"
    assert os.path.isdir(PROJECT_DIR), f"project directory missing: {PROJECT_DIR}"

    # Write harness
    with open(HARNESS_PATH, "w") as f:
        f.write(HARNESS_SRC)

    # Clean prior log
    if os.path.exists(LOG_FILE):
        os.remove(LOG_FILE)

    # Trigger asset import so class_name and .tres references resolve.
    import_result = _run_godot(
        ["godot", "--headless", "--path", PROJECT_DIR, "--import"],
        timeout=120,
    )
    # --import returns non-zero on some Godot builds; continue regardless.

    # Run the harness as a SceneTree script
    run_result = _run_godot(
        [
            "godot",
            "--headless",
            "--path",
            PROJECT_DIR,
            "-s",
            "res://verify_harness.gd",
        ],
        timeout=180,
    )

    yield {
        "import": import_result,
        "run": run_result,
    }


def test_verify_log_file_created(verify_run):
    assert os.path.isfile(LOG_FILE), (
        "Verification log file was not created at "
        f"{LOG_FILE}. Godot stdout: {verify_run['run'].stdout!r} "
        f"stderr: {verify_run['run'].stderr!r}"
    )


def test_verify_result_ok(verify_run):
    assert os.path.isfile(LOG_FILE), f"missing log file {LOG_FILE}"
    with open(LOG_FILE) as f:
        content = f.read().strip()
    assert content == "VERIFY_OK", (
        f"Godot verification harness reported failure. Log: {content!r}. "
        f"Godot stdout: {verify_run['run'].stdout!r} stderr: {verify_run['run'].stderr!r}"
    )


def test_godot_harness_exit_code(verify_run):
    assert verify_run["run"].returncode == 0, (
        f"godot exited with code {verify_run['run'].returncode}. "
        f"stdout: {verify_run['run'].stdout!r} stderr: {verify_run['run'].stderr!r}"
    )
