import glob
import os
import re
import shutil
import subprocess

import pytest

PROJECT_DIR = "/home/user/ecs_project"
VERIFIER_BASENAME = "_ecs_verifier.gd"
VERIFIER_PATH = os.path.join(PROJECT_DIR, VERIFIER_BASENAME)

# A GDScript program (extends SceneTree) that exercises the World ECS entirely
# in-process and prints one machine-readable "RESULT <name> PASS/FAIL <detail>"
# line per check. The pytest cases below parse these lines. This keeps every
# assertion deterministic and fully offline (headless Godot only).
VERIFIER_GD = r'''extends SceneTree

var _results := {}

func _report(name: String, ok: bool, detail: String = "") -> void:
	_results[name] = {"ok": ok, "detail": detail}

func _types_equal(got, expected) -> bool:
	if typeof(got) != TYPE_ARRAY:
		return false
	if got.size() != expected.size():
		return false
	for i in range(got.size()):
		if String(got[i]) != String(expected[i]):
			return false
	return true

func _int_array_equal(got, expected) -> bool:
	if typeof(got) != TYPE_ARRAY:
		return false
	if got.size() != expected.size():
		return false
	for i in range(got.size()):
		if int(got[i]) != int(expected[i]):
			return false
	return true

func _contains(arr, val) -> bool:
	if typeof(arr) != TYPE_ARRAY:
		return false
	for x in arr:
		if int(x) == int(val):
			return true
	return false

func _sorted_by_index(w, arr) -> Array:
	var out = arr.duplicate()
	for i in range(1, out.size()):
		var key = out[i]
		var j = i - 1
		while j >= 0 and int(w.get_index(out[j])) > int(w.get_index(key)):
			out[j + 1] = out[j]
			j -= 1
		out[j + 1] = key
	return out

func _get_key(w, e, type, key):
	var c = w.get_component(e, type)
	if typeof(c) != TYPE_DICTIONARY:
		return null
	if not c.has(key):
		return null
	return c[key]

func _init() -> void:
	var script = load("res://ecs/world.gd")
	if script == null:
		print("RESULT load_world FAIL could_not_load_world_gd")
		quit(1)
		return
	_report("load_world", true)

	var methods = [
		"create_entity", "destroy_entity", "is_alive", "get_index",
		"get_generation", "add_component", "remove_component", "has_component",
		"get_component", "get_component_types", "query",
		"get_entities_with_exact_types",
	]
	var probe = script.new()
	var missing = []
	for m in methods:
		if not probe.has_method(m):
			missing.append(m)
	if missing.size() > 0:
		print("RESULT c0_methods FAIL missing:%s" % str(missing))
		quit(1)
		return
	_report("c0_methods", true)

	_group_lifecycle(script)
	_group_membership(script)
	_group_query(script)
	_group_recycle(script)

	var all_ok := true
	for k in _results.keys():
		var r = _results[k]
		if r["ok"]:
			print("RESULT %s PASS" % k)
		else:
			all_ok = false
			print("RESULT %s FAIL %s" % [k, r["detail"]])
	quit(0 if all_ok else 1)

func _group_lifecycle(script) -> void:
	var w = script.new()
	var e = w.create_entity()
	_report("c1_is_alive", w.is_alive(e) == true)
	var types = w.get_component_types(e)
	_report("c1_empty_types", typeof(types) == TYPE_ARRAY and types.size() == 0)
	_report("c1_query_all_contains", _contains(w.query([]), e))
	_report("c1_exact_empty_contains", _contains(w.get_entities_with_exact_types([]), e))

func _group_membership(script) -> void:
	var w = script.new()
	var e = w.create_entity()
	var a1 = w.add_component(e, &"Position", {"x": 1, "y": 2})
	var a2 = w.add_component(e, &"Velocity", {"dx": 3, "dy": 4})
	var a3 = w.add_component(e, &"Health", {"hp": 100})
	_report("c2_add_returns_true", a1 == true and a2 == true and a3 == true)
	_report("c2_types_three", _types_equal(w.get_component_types(e), ["Health", "Position", "Velocity"]))
	_report("c2_remove_vel_true", w.remove_component(e, &"Velocity") == true)
	_report("c2_types_two", _types_equal(w.get_component_types(e), ["Health", "Position"]))
	_report("c2_remove_vel_again_false", w.remove_component(e, &"Velocity") == false)

	_report("c3_pos_x", _get_key(w, e, &"Position", "x") == 1)
	_report("c3_pos_y", _get_key(w, e, &"Position", "y") == 2)
	_report("c3_health_hp", _get_key(w, e, &"Health", "hp") == 100)

	var upd = w.add_component(e, &"Position", {"x": 9, "y": 9})
	_report("c3_update_returns_true", upd == true)
	_report("c3_types_unchanged", _types_equal(w.get_component_types(e), ["Health", "Position"]))
	_report("c3_update_value", _get_key(w, e, &"Position", "x") == 9)
	_report("c3_vel_null_after_remove", w.get_component(e, &"Velocity") == null)

func _group_query(script) -> void:
	var w = script.new()
	var a = w.create_entity()
	w.add_component(a, &"Position", {})
	w.add_component(a, &"Velocity", {})
	var b = w.create_entity()
	w.add_component(b, &"Position", {})
	var c = w.create_entity()
	w.add_component(c, &"Position", {})
	w.add_component(c, &"Velocity", {})
	w.add_component(c, &"Health", {})
	var d = w.create_entity()
	w.add_component(d, &"Health", {})

	_report("c4_query_pos_vel", _int_array_equal(w.query([&"Position", &"Velocity"]), _sorted_by_index(w, [a, c])))
	_report("c4_query_pos", _int_array_equal(w.query([&"Position"]), _sorted_by_index(w, [a, b, c])))
	_report("c4_query_dup", _int_array_equal(w.query([&"Position", &"Velocity", &"Velocity"]), _sorted_by_index(w, [a, c])))
	_report("c4_exact_pos_vel", _int_array_equal(w.get_entities_with_exact_types([&"Position", &"Velocity"]), _sorted_by_index(w, [a])))
	_report("c4_exact_health", _int_array_equal(w.get_entities_with_exact_types([&"Health"]), _sorted_by_index(w, [d])))

func _group_recycle(script) -> void:
	var w = script.new()
	var e1 = w.create_entity()
	var i1 = w.get_index(e1)
	var g1 = w.get_generation(e1)
	w.add_component(e1, &"Position", {"x": 7})
	_report("c5_destroy_true", w.destroy_entity(e1) == true)
	var e2 = w.create_entity()
	_report("c5_index_recycled", w.get_index(e2) == i1)
	_report("c5_generation_differs", w.get_generation(e2) != g1)
	_report("c5_e1_dead", w.is_alive(e1) == false)
	_report("c5_e2_alive", w.is_alive(e2) == true)
	_report("c5_stale_has_false", w.has_component(e1, &"Position") == false)
	_report("c5_stale_get_null", w.get_component(e1, &"Position") == null)
	var t2 = w.get_component_types(e2)
	_report("c5_e2_empty_types", typeof(t2) == TYPE_ARRAY and t2.size() == 0)
	_report("c5_e2_pos_null", w.get_component(e2, &"Position") == null)
	_report("c5_stale_add_false", w.add_component(e1, &"Health", {"hp": 1}) == false)
	var t2b = w.get_component_types(e2)
	_report("c5_e2_still_empty", typeof(t2b) == TYPE_ARRAY and t2b.size() == 0)
	_report("c5_destroy_again_false", w.destroy_entity(e1) == false)
'''

RESULT_RE = re.compile(r"^RESULT\s+(\S+)\s+(PASS|FAIL)(?:\s+(.*))?$")


def _cleanup_verifier():
    for path in glob.glob(VERIFIER_PATH + "*"):
        try:
            os.remove(path)
        except OSError:
            pass


def _run_verifier():
    result = subprocess.run(
        ["godot", "--headless", "--path", PROJECT_DIR, "-s", "res://" + VERIFIER_BASENAME],
        capture_output=True,
        text=True,
        timeout=240,
    )
    combined = (result.stdout or "") + "\n" + (result.stderr or "")
    parsed = {}
    for line in combined.splitlines():
        m = RESULT_RE.match(line.strip())
        if m:
            parsed[m.group(1)] = (m.group(2), (m.group(3) or "").strip())
    return parsed, combined


@pytest.fixture(scope="session")
def ecs_results():
    assert shutil.which("godot") is not None, "The 'godot' binary was not found in PATH."
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."
    world_gd = os.path.join(PROJECT_DIR, "ecs", "world.gd")
    assert os.path.isfile(world_gd), (
        f"Expected the ECS implementation at {world_gd}; it does not exist."
    )

    _cleanup_verifier()
    with open(VERIFIER_PATH, "w") as f:
        f.write(VERIFIER_GD)

    try:
        parsed, combined = _run_verifier()
        # A brand-new Godot project performs a resource import pass on first run,
        # which can occasionally consume the first invocation. Retry once if the
        # verifier produced no machine-readable results.
        if not parsed:
            parsed, combined = _run_verifier()
    finally:
        _cleanup_verifier()

    assert parsed, (
        "The headless Godot verifier produced no RESULT lines. Raw output:\n" + combined
    )
    return parsed


def _assert_check(ecs_results, name):
    assert name in ecs_results, (
        f"Verifier check '{name}' was not reported (the implementation likely "
        f"crashed or is missing behavior). Reported checks: {sorted(ecs_results.keys())}"
    )
    status, detail = ecs_results[name]
    assert status == "PASS", f"Verifier check '{name}' failed: {detail}"


def test_world_script_loads(ecs_results):
    _assert_check(ecs_results, "load_world")


def test_required_methods_present(ecs_results):
    _assert_check(ecs_results, "c0_methods")


def test_new_entity_is_alive(ecs_results):
    _assert_check(ecs_results, "c1_is_alive")


def test_new_entity_in_empty_archetype(ecs_results):
    _assert_check(ecs_results, "c1_empty_types")


def test_query_all_matches_new_entity(ecs_results):
    _assert_check(ecs_results, "c1_query_all_contains")


def test_exact_empty_archetype_matches_new_entity(ecs_results):
    _assert_check(ecs_results, "c1_exact_empty_contains")


def test_add_component_returns_true(ecs_results):
    _assert_check(ecs_results, "c2_add_returns_true")


def test_archetype_membership_after_adds(ecs_results):
    _assert_check(ecs_results, "c2_types_three")


def test_remove_component_returns_true(ecs_results):
    _assert_check(ecs_results, "c2_remove_vel_true")


def test_archetype_membership_after_remove(ecs_results):
    _assert_check(ecs_results, "c2_types_two")


def test_remove_absent_component_returns_false(ecs_results):
    _assert_check(ecs_results, "c2_remove_vel_again_false")


def test_data_integrity_position_x(ecs_results):
    _assert_check(ecs_results, "c3_pos_x")


def test_data_integrity_position_y(ecs_results):
    _assert_check(ecs_results, "c3_pos_y")


def test_data_integrity_health(ecs_results):
    _assert_check(ecs_results, "c3_health_hp")


def test_update_existing_component_returns_true(ecs_results):
    _assert_check(ecs_results, "c3_update_returns_true")


def test_update_existing_component_keeps_archetype(ecs_results):
    _assert_check(ecs_results, "c3_types_unchanged")


def test_update_existing_component_changes_value(ecs_results):
    _assert_check(ecs_results, "c3_update_value")


def test_removed_component_reads_null(ecs_results):
    _assert_check(ecs_results, "c3_vel_null_after_remove")


def test_query_two_component_signature(ecs_results):
    _assert_check(ecs_results, "c4_query_pos_vel")


def test_query_single_component_signature(ecs_results):
    _assert_check(ecs_results, "c4_query_pos")


def test_query_duplicate_types_treated_as_set(ecs_results):
    _assert_check(ecs_results, "c4_query_dup")


def test_exact_archetype_excludes_supersets(ecs_results):
    _assert_check(ecs_results, "c4_exact_pos_vel")


def test_exact_archetype_single_type(ecs_results):
    _assert_check(ecs_results, "c4_exact_health")


def test_destroy_entity_returns_true(ecs_results):
    _assert_check(ecs_results, "c5_destroy_true")


def test_index_recycled_on_recreate(ecs_results):
    _assert_check(ecs_results, "c5_index_recycled")


def test_generation_bumped_on_recycle(ecs_results):
    _assert_check(ecs_results, "c5_generation_differs")


def test_stale_handle_not_alive(ecs_results):
    _assert_check(ecs_results, "c5_e1_dead")


def test_recycled_handle_alive(ecs_results):
    _assert_check(ecs_results, "c5_e2_alive")


def test_stale_has_component_false(ecs_results):
    _assert_check(ecs_results, "c5_stale_has_false")


def test_stale_get_component_null(ecs_results):
    _assert_check(ecs_results, "c5_stale_get_null")


def test_recycled_entity_starts_empty(ecs_results):
    _assert_check(ecs_results, "c5_e2_empty_types")


def test_recycled_entity_has_no_stale_data(ecs_results):
    _assert_check(ecs_results, "c5_e2_pos_null")


def test_stale_add_component_rejected(ecs_results):
    _assert_check(ecs_results, "c5_stale_add_false")


def test_stale_add_does_not_affect_live_entity(ecs_results):
    _assert_check(ecs_results, "c5_e2_still_empty")


def test_destroy_stale_handle_returns_false(ecs_results):
    _assert_check(ecs_results, "c5_destroy_again_false")
