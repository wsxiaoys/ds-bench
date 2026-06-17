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

    func _vec_close(a: Vector2, b: Vector2) -> bool:
        return abs(a.x - b.x) < 1e-4 and abs(a.y - b.y) < 1e-4

    func _has_required_export(script_inst: Object, expected: Dictionary) -> Array:
        var props = script_inst.get_property_list()
        var seen := {}
        for p in props:
            if expected.has(p.name):
                seen[p.name] = p.type
        var missing := []
        for k in expected:
            if not seen.has(k):
                missing.append("missing %s" % k)
            elif int(seen[k]) != int(expected[k]):
                missing.append("%s has type %d, expected %d" % [k, seen[k], expected[k]])
        return missing

    func _read_text(path: String) -> String:
        var f := FileAccess.open(path, FileAccess.READ)
        if f == null:
            return ""
        var s := f.get_as_text()
        f.close()
        return s

    func _run() -> void:
        # 1. Load scripts
        var item_script := load("res://scripts/ItemData.gd")
        if item_script == null:
            _fail("scripts/ItemData.gd missing or failed to load")
            _write_and_quit(false)
            return
        var save_script := load("res://scripts/GameSaveData.gd")
        if save_script == null:
            _fail("scripts/GameSaveData.gd missing or failed to load")
            _write_and_quit(false)
            return
        var mgr_script := load("res://scripts/SaveManager.gd")
        if mgr_script == null:
            _fail("scripts/SaveManager.gd missing or failed to load")
            _write_and_quit(false)
            return

        var item_src := _read_text("res://scripts/ItemData.gd")
        if not item_src.contains("class_name ItemData"):
            _fail("ItemData.gd missing `class_name ItemData`")
        if not item_src.contains("extends Resource"):
            _fail("ItemData.gd missing `extends Resource`")

        var save_src := _read_text("res://scripts/GameSaveData.gd")
        if not save_src.contains("class_name GameSaveData"):
            _fail("GameSaveData.gd missing `class_name GameSaveData`")
        if not save_src.contains("extends Resource"):
            _fail("GameSaveData.gd missing `extends Resource`")

        var mgr_src := _read_text("res://scripts/SaveManager.gd")
        if not mgr_src.contains("class_name SaveManager"):
            _fail("SaveManager.gd missing `class_name SaveManager`")

        # 2. Instantiate ItemData sub-resources
        var item_a = item_script.new()
        if not (item_a is Resource):
            _fail("ItemData does not extend Resource")
            _write_and_quit(false)
            return
        var item_required := {"id": TYPE_STRING, "quantity": TYPE_INT, "rarity": TYPE_INT}
        var miss_item := _has_required_export(item_a, item_required)
        for m in miss_item:
            _fail("ItemData " + m)
        item_a.id = "sword_iron"
        item_a.quantity = 1
        item_a.rarity = 3

        var item_b = item_script.new()
        item_b.id = "potion_red"
        item_b.quantity = 5
        item_b.rarity = 1

        # 3. Instantiate GameSaveData
        var original = save_script.new()
        if not (original is Resource):
            _fail("GameSaveData does not extend Resource")
            _write_and_quit(false)
            return

        var save_required := {
            "player_position": TYPE_VECTOR2,
            "inventory": TYPE_ARRAY,
            "unlocked_levels": TYPE_PACKED_STRING_ARRAY,
            "last_played": TYPE_INT,
        }
        var miss_save := _has_required_export(original, save_required)
        for m in miss_save:
            _fail("GameSaveData " + m)

        original.player_position = Vector2(123.5, -42.25)
        var typed_inv := Array([], TYPE_OBJECT, "Resource", item_script)
        typed_inv.append(item_a)
        typed_inv.append(item_b)
        original.set("inventory", typed_inv)
        original.unlocked_levels = PackedStringArray(["forest", "cave", "castle"])
        original.last_played = 1717000000

        # Sanity check the inventory was accepted
        if int(original.inventory.size()) != 2:
            _fail("GameSaveData.inventory size %d, expected 2 (typed array assignment may have failed)" % int(original.inventory.size()))
            _write_and_quit(false)
            return

        # 4. Instantiate SaveManager
        var mgr = mgr_script.new()
        if mgr == null:
            _fail("Failed to instantiate SaveManager")
            _write_and_quit(false)
            return
        for m_name in ["save_to_disk", "load_from_disk", "compute_hash"]:
            if not mgr.has_method(m_name):
                _fail("SaveManager missing method: %s" % m_name)
        if not _errors.is_empty():
            _write_and_quit(false)
            return

        # 5. Hash determinism
        var h0 = mgr.compute_hash(original)
        if typeof(h0) != TYPE_STRING:
            _fail("compute_hash must return String, got type %d" % typeof(h0))
            _write_and_quit(false)
            return
        if h0.length() == 0:
            _fail("compute_hash returned empty string")
        var h0b = mgr.compute_hash(original)
        if h0 != h0b:
            _fail("compute_hash is non-deterministic: %s vs %s" % [h0, h0b])

        # 6. Text round-trip
        var text_in := "user://harness_save_text"
        var save_err_text = mgr.save_to_disk(original, text_in, false)
        if int(save_err_text) != int(OK):
            _fail("save_to_disk (text) returned %s, expected OK" % str(save_err_text))
        if not FileAccess.file_exists(text_in + ".tres"):
            _fail("Expected text save file at %s.tres" % text_in)

        var loaded_text = mgr.load_from_disk(text_in)
        if loaded_text == null:
            _fail("load_from_disk(text) returned null")
        elif loaded_text.get_script() != save_script:
            _fail("Loaded text resource is not GameSaveData")
        else:
            if not _vec_close(loaded_text.player_position, original.player_position):
                _fail("text: player_position mismatch: %s vs %s" % [str(loaded_text.player_position), str(original.player_position)])
            if int(loaded_text.last_played) != int(original.last_played):
                _fail("text: last_played mismatch: %s vs %s" % [str(loaded_text.last_played), str(original.last_played)])
            var lt_levels = loaded_text.unlocked_levels
            if lt_levels.size() != original.unlocked_levels.size():
                _fail("text: unlocked_levels size mismatch")
            else:
                for i in range(lt_levels.size()):
                    if String(lt_levels[i]) != String(original.unlocked_levels[i]):
                        _fail("text: unlocked_levels[%d] mismatch" % i)
            var lt_inv = loaded_text.inventory
            if lt_inv.size() != 2:
                _fail("text: inventory size %d, expected 2" % lt_inv.size())
            else:
                for i in range(2):
                    var loaded_item = lt_inv[i]
                    var orig_item = original.inventory[i]
                    if loaded_item == null or not (loaded_item is Resource):
                        _fail("text: inventory[%d] is not a Resource" % i)
                        continue
                    if loaded_item.get_script() != item_script:
                        _fail("text: inventory[%d] is not ItemData (script mismatch)" % i)
                        continue
                    if String(loaded_item.id) != String(orig_item.id):
                        _fail("text: inventory[%d].id %s != %s" % [i, str(loaded_item.id), str(orig_item.id)])
                    if int(loaded_item.quantity) != int(orig_item.quantity):
                        _fail("text: inventory[%d].quantity %d != %d" % [i, int(loaded_item.quantity), int(orig_item.quantity)])
                    if int(loaded_item.rarity) != int(orig_item.rarity):
                        _fail("text: inventory[%d].rarity %d != %d" % [i, int(loaded_item.rarity), int(orig_item.rarity)])
            var h_text = mgr.compute_hash(loaded_text)
            if h_text != h0:
                _fail("text: round-trip hash mismatch: %s vs %s" % [h_text, h0])

        # 7. Binary round-trip
        var bin_in := "user://harness_save_bin"
        var save_err_bin = mgr.save_to_disk(original, bin_in, true)
        if int(save_err_bin) != int(OK):
            _fail("save_to_disk (binary) returned %s, expected OK" % str(save_err_bin))
        if not FileAccess.file_exists(bin_in + ".res"):
            _fail("Expected binary save file at %s.res" % bin_in)

        var loaded_bin = mgr.load_from_disk(bin_in)
        if loaded_bin == null:
            _fail("load_from_disk(binary) returned null")
        elif loaded_bin.get_script() != save_script:
            _fail("Loaded binary resource is not GameSaveData")
        else:
            if not _vec_close(loaded_bin.player_position, original.player_position):
                _fail("binary: player_position mismatch")
            if int(loaded_bin.last_played) != int(original.last_played):
                _fail("binary: last_played mismatch")
            var lb_levels = loaded_bin.unlocked_levels
            if lb_levels.size() != original.unlocked_levels.size():
                _fail("binary: unlocked_levels size mismatch")
            else:
                for i in range(lb_levels.size()):
                    if String(lb_levels[i]) != String(original.unlocked_levels[i]):
                        _fail("binary: unlocked_levels[%d] mismatch" % i)
            var lb_inv = loaded_bin.inventory
            if lb_inv.size() != 2:
                _fail("binary: inventory size %d, expected 2" % lb_inv.size())
            else:
                for i in range(2):
                    var loaded_item = lb_inv[i]
                    var orig_item = original.inventory[i]
                    if loaded_item == null or not (loaded_item is Resource):
                        _fail("binary: inventory[%d] is not a Resource" % i)
                        continue
                    if loaded_item.get_script() != item_script:
                        _fail("binary: inventory[%d] is not ItemData" % i)
                        continue
                    if String(loaded_item.id) != String(orig_item.id):
                        _fail("binary: inventory[%d].id mismatch" % i)
                    if int(loaded_item.quantity) != int(orig_item.quantity):
                        _fail("binary: inventory[%d].quantity mismatch" % i)
                    if int(loaded_item.rarity) != int(orig_item.rarity):
                        _fail("binary: inventory[%d].rarity mismatch" % i)
            var h_bin = mgr.compute_hash(loaded_bin)
            if h_bin != h0:
                _fail("binary: round-trip hash mismatch: %s vs %s" % [h_bin, h0])

        # 8. Format differentiation
        var text_content := _read_text("user://harness_save_text.tres")
        if not text_content.contains("GameSaveData"):
            _fail(".tres file does not contain readable `GameSaveData` reference")
        var bin_path := ProjectSettings.globalize_path("user://harness_save_bin.res")
        var bf := FileAccess.open("user://harness_save_bin.res", FileAccess.READ)
        if bf == null:
            _fail("Could not open binary save for header inspection at %s" % bin_path)
        else:
            var magic := bf.get_buffer(4)
            bf.close()
            if magic.size() != 4 or magic[0] != 0x52 or magic[1] != 0x53 or magic[2] != 0x52 or magic[3] != 0x43:
                _fail(".res file does not start with `RSRC` magic header; got bytes %s" % str(magic))

        # 9. Hash sensitivity (top-level + nested)
        var modified = save_script.new()
        modified.player_position = Vector2(123.5, -42.25)
        var inv_same := Array([], TYPE_OBJECT, "Resource", item_script)
        inv_same.append(item_a)
        inv_same.append(item_b)
        modified.set("inventory", inv_same)
        modified.unlocked_levels = PackedStringArray(["forest", "cave", "castle"])
        modified.last_played = 1717000001  # differs by 1
        var h_mod = mgr.compute_hash(modified)
        if h_mod == h0:
            _fail("compute_hash is insensitive to top-level last_played change")

        var item_a2 = item_script.new()
        item_a2.id = "sword_iron"
        item_a2.quantity = 2  # differs
        item_a2.rarity = 3
        var modified2 = save_script.new()
        modified2.player_position = Vector2(123.5, -42.25)
        var inv2 := Array([], TYPE_OBJECT, "Resource", item_script)
        inv2.append(item_a2)
        inv2.append(item_b)
        modified2.set("inventory", inv2)
        modified2.unlocked_levels = PackedStringArray(["forest", "cave", "castle"])
        modified2.last_played = 1717000000
        var h_mod2 = mgr.compute_hash(modified2)
        if h_mod2 == h0:
            _fail("compute_hash is insensitive to nested ItemData.quantity change")

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

    with open(HARNESS_PATH, "w") as f:
        f.write(HARNESS_SRC)

    if os.path.exists(LOG_FILE):
        os.remove(LOG_FILE)

    import_result = _run_godot(
        ["godot", "--headless", "--path", PROJECT_DIR, "--import"],
        timeout=180,
    )

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
