import json
import math
import os
import shutil
import subprocess

import pytest

PROJECT_DIR = "/home/user/instancing_project"
SCRIPT_PATH = os.path.join(PROJECT_DIR, "instancing", "instance_field.gd")
FIELD_RES = os.path.join(PROJECT_DIR, "build", "field.res")
REPORT_JSON = os.path.join(PROJECT_DIR, "build", "report.json")
CHECKER_GD = os.path.join(PROJECT_DIR, "_mm_checker.gd")
CHECKER_OUT = os.path.join(PROJECT_DIR, "_checker_result.json")

TOL = 1e-3
STRIDE = 20  # 12 transform + 4 color + 4 custom-data floats per instance.

# Query boxes exercised by the Godot checker. The first one is the reported
# query; the rest are hidden boxes used as an anti-cheat / independent-oracle
# check. Each entry: (name, box_min, box_max).
BOXES = [
    ("report_box", (-1.0, 0.0, -3.0), (5.0, 1.5, 0.0)),
    ("all", (-100.0, -100.0, -100.0), (100.0, 100.0, 100.0)),
    ("none", (100.0, 100.0, 100.0), (200.0, 200.0, 200.0)),
    ("single", (-5.0, 0.0, -3.0), (-5.0, 0.0, -3.0)),
    ("slab", (-1.0, 0.0, -3.0), (1.0, 2.0, 1.5)),
]

REPORT_INDICES = [
    2, 3, 4, 5, 8, 9, 10, 11, 14, 15, 16, 17, 20, 21, 22, 23,
    32, 33, 34, 35, 38, 39, 40, 41, 44, 45, 46, 47, 50, 51, 52, 53,
    62, 63, 64, 65, 68, 69, 70, 71, 74, 75, 76, 77, 80, 81, 82, 83,
]


# --------------------------------------------------------------------------
# Independent oracle (pure Python) for the deterministic instance field.
# --------------------------------------------------------------------------
def grid(i):
    return i % 6, (i // 6) % 5, i // 30


def expected_instance(i):
    gx, gy, gz = grid(i)
    origin = (-5.0 + 2.0 * gx, 0.5 * gy, -3.0 + 1.5 * gz)
    s = 0.5 + 0.1 * ((gx + gz) % 4)
    a = math.radians(30.0 * (gy % 3))
    color = (gx / 5.0, gy / 4.0, gz / 3.0, 1.0)
    custom = (i / 1000.0, float(gx + gy + gz), 1.0 + 0.5 * (i % 7), float((gx + gz) % 2))
    return {"gx": gx, "gy": gy, "gz": gz, "origin": origin, "s": s, "a": a,
            "color": color, "custom": custom}


def cull_expected(bmin, bmax):
    indices = []
    weight = 0.0
    flagged = 0
    for i in range(120):
        e = expected_instance(i)
        ox, oy, oz = e["origin"]
        if (bmin[0] <= ox <= bmax[0]
                and bmin[1] <= oy <= bmax[1]
                and bmin[2] <= oz <= bmax[2]):
            indices.append(i)
            weight += e["custom"][2]
            if e["custom"][3] >= 0.5:
                flagged += 1
    return indices, weight, flagged


def decode_instance(buffer, i):
    """Decode instance `i` from a 3D MultiMesh buffer (colors + custom data
    enabled). Layout per instance: 12 transform floats laid out as three rows
    [b_r0, b_r1, b_r2, origin], then 4 color floats, then 4 custom floats."""
    b = buffer[i * STRIDE:(i + 1) * STRIDE]
    # Basis rows.
    row0 = (b[0], b[1], b[2])
    row1 = (b[4], b[5], b[6])
    row2 = (b[8], b[9], b[10])
    origin = (b[3], b[7], b[11])
    # Columns = transformed unit axes.
    col0 = (row0[0], row1[0], row2[0])
    col1 = (row0[1], row1[1], row2[1])
    col2 = (row0[2], row1[2], row2[2])
    color = (b[12], b[13], b[14], b[15])
    custom = (b[16], b[17], b[18], b[19])
    return {"origin": origin, "col0": col0, "col1": col1, "col2": col2,
            "color": color, "custom": custom}


CHECKER_TEMPLATE = r"""extends SceneTree

func _dump_mm(mm) -> Dictionary:
    var d := {}
    if mm == null or not (mm is MultiMesh):
        d["ok"] = false
        return d
    d["ok"] = true
    d["class"] = mm.get_class()
    d["transform_format"] = mm.transform_format
    d["use_colors"] = mm.use_colors
    d["use_custom_data"] = mm.use_custom_data
    d["instance_count"] = mm.instance_count
    var buf: PackedFloat32Array = mm.buffer
    var arr := []
    for v in buf:
        arr.append(v)
    d["buffer"] = arr
    return d

func _init():
    var out := {}
    var errors := []

    var res_mm = null
    if ResourceLoader.exists("res://build/field.res"):
        res_mm = ResourceLoader.load("res://build/field.res")
    else:
        errors.append("res://build/field.res not found")
    out["resource"] = _dump_mm(res_mm)

    var field = null
    var scr = load("res://instancing/instance_field.gd")
    if scr == null:
        errors.append("could not load res://instancing/instance_field.gd")
    else:
        field = scr.new()

    var built_mm = null
    if field != null:
        built_mm = field.build()
    out["built"] = _dump_mm(built_mm)

    var boxes = __BOXES__
    var culls := {}
    for b in boxes:
        var bname: String = b[0]
        var bmin := Vector3(b[1][0], b[1][1], b[1][2])
        var bmax := Vector3(b[2][0], b[2][1], b[2][2])
        var entry := {"min": [bmin.x, bmin.y, bmin.z], "max": [bmax.x, bmax.y, bmax.z]}
        if field != null:
            var r: Dictionary = field.cull(bmin, bmax)
            var idx := []
            for v in r.get("indices", []):
                idx.append(int(v))
            entry["indices"] = idx
            entry["count"] = int(r.get("count", -1))
            entry["weight_sum"] = float(r.get("weight_sum", 0.0))
            entry["flagged_count"] = int(r.get("flagged_count", -1))
        culls[bname] = entry
    out["culls"] = culls
    out["errors"] = errors

    var f = FileAccess.open("res://_checker_result.json", FileAccess.WRITE)
    f.store_string(JSON.stringify(out))
    f.close()
    print("CHECKER_DONE")
    quit()
"""


def _boxes_to_gd(boxes):
    parts = []
    for name, bmin, bmax in boxes:
        parts.append(
            '["%s", [%r, %r, %r], [%r, %r, %r]]'
            % (name, bmin[0], bmin[1], bmin[2], bmax[0], bmax[1], bmax[2])
        )
    return "[" + ", ".join(parts) + "]"


@pytest.fixture(scope="session")
def checker():
    """Run a Godot headless checker that extracts the MultiMesh buffer and
    cull() results, then return the parsed JSON dump."""
    godot = shutil.which("godot")
    assert godot is not None, "godot binary not found in PATH."

    gd_source = CHECKER_TEMPLATE.replace("__BOXES__", _boxes_to_gd(BOXES))
    with open(CHECKER_GD, "w") as fh:
        fh.write(gd_source)
    if os.path.exists(CHECKER_OUT):
        os.remove(CHECKER_OUT)

    result = subprocess.run(
        [godot, "--headless", "--path", PROJECT_DIR, "--script", "res://_mm_checker.gd"],
        capture_output=True,
        text=True,
        timeout=300,
    )
    print("=== checker stdout ===")
    print(result.stdout)
    print("=== checker stderr ===")
    print(result.stderr)

    assert os.path.isfile(CHECKER_OUT), (
        "Godot checker did not produce an output file. This usually means the "
        "solution's script failed to load or crashed.\n"
        f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )
    with open(CHECKER_OUT) as fh:
        data = json.load(fh)
    return data


def _assert_config_and_buffer(dump, label):
    assert dump.get("ok") is True, f"{label}: not a valid MultiMesh."
    assert dump.get("transform_format") == 1, (
        f"{label}: transform_format must be 1 (TRANSFORM_3D), got "
        f"{dump.get('transform_format')}."
    )
    assert dump.get("use_colors") is True, f"{label}: use_colors must be true."
    assert dump.get("use_custom_data") is True, f"{label}: use_custom_data must be true."
    assert dump.get("instance_count") == 120, (
        f"{label}: instance_count must be 120, got {dump.get('instance_count')}."
    )
    buffer = dump.get("buffer", [])
    assert len(buffer) == 120 * STRIDE, (
        f"{label}: expected an instance buffer of {120 * STRIDE} floats "
        f"(120 instances x {STRIDE}), got {len(buffer)}. In headless mode the "
        f"per-instance data must be stored in the MultiMesh buffer."
    )

    for i in range(120):
        e = expected_instance(i)
        got = decode_instance(buffer, i)
        s = e["s"]
        a = e["a"]

        # Origin drives culling and must be exact.
        for axis, exp_v, got_v in zip("xyz", e["origin"], got["origin"]):
            assert abs(exp_v - got_v) <= TOL, (
                f"{label}: instance {i} origin.{axis} expected {exp_v}, got {got_v}."
            )

        # Basis: +Y rotation by `a`, uniformly scaled by `s`.
        col0 = got["col0"]
        col1 = got["col1"]
        col2 = got["col2"]
        len0 = math.sqrt(col0[0] ** 2 + col0[1] ** 2 + col0[2] ** 2)
        len2 = math.sqrt(col2[0] ** 2 + col2[1] ** 2 + col2[2] ** 2)
        assert abs(len0 - s) <= TOL, (
            f"{label}: instance {i} scale of X axis expected {s}, got {len0}."
        )
        assert abs(len2 - s) <= TOL, (
            f"{label}: instance {i} scale of Z axis expected {s}, got {len2}."
        )
        assert (abs(col1[0]) <= TOL and abs(col1[1] - s) <= TOL and abs(col1[2]) <= TOL), (
            f"{label}: instance {i} transformed Y axis expected (0,{s},0), got {col1}."
        )
        assert abs(col0[0] - s * math.cos(a)) <= TOL, (
            f"{label}: instance {i} X-axis.x expected {s * math.cos(a)}, got {col0[0]}."
        )
        assert abs(col2[2] - s * math.cos(a)) <= TOL, (
            f"{label}: instance {i} Z-axis.z expected {s * math.cos(a)}, got {col2[2]}."
        )
        assert abs(abs(col0[2]) - s * abs(math.sin(a))) <= TOL, (
            f"{label}: instance {i} |X-axis.z| expected {s * abs(math.sin(a))}, "
            f"got {abs(col0[2])}."
        )

        # Color.
        for ch, exp_v, got_v in zip("rgba", e["color"], got["color"]):
            assert abs(exp_v - got_v) <= TOL, (
                f"{label}: instance {i} color.{ch} expected {exp_v}, got {got_v}."
            )

        # Custom data.
        for ch, exp_v, got_v in zip("rgba", e["custom"], got["custom"]):
            assert abs(exp_v - got_v) <= TOL, (
                f"{label}: instance {i} custom_data.{ch} expected {exp_v}, got {got_v}."
            )


# --------------------------------------------------------------------------
# Artifact existence
# --------------------------------------------------------------------------
def test_class_script_exists():
    assert os.path.isfile(SCRIPT_PATH), f"Expected class script at {SCRIPT_PATH}."


def test_field_resource_exists():
    assert os.path.isfile(FIELD_RES), f"Expected saved MultiMesh at {FIELD_RES}."


def test_report_json_exists():
    assert os.path.isfile(REPORT_JSON), f"Expected report at {REPORT_JSON}."


# --------------------------------------------------------------------------
# Saved resource: configuration + per-instance buffer data
# --------------------------------------------------------------------------
def test_checker_no_load_errors(checker):
    assert not checker.get("errors"), f"Checker reported errors: {checker.get('errors')}"


def test_saved_resource_instances(checker):
    _assert_config_and_buffer(checker["resource"], "field.res")


# --------------------------------------------------------------------------
# Freshly built field via the class API: configuration + per-instance data
# --------------------------------------------------------------------------
def test_built_field_instances(checker):
    _assert_config_and_buffer(checker["built"], "InstanceField.build()")


# --------------------------------------------------------------------------
# report.json content
# --------------------------------------------------------------------------
def test_report_json_content():
    with open(REPORT_JSON) as fh:
        report = json.load(fh)

    assert report.get("instance_count") == 120, "report.instance_count must be 120."
    assert report.get("transform_format") == 1, "report.transform_format must be 1."
    assert report.get("use_colors") is True, "report.use_colors must be true."
    assert report.get("use_custom_data") is True, "report.use_custom_data must be true."

    qmin = report.get("query_min")
    qmax = report.get("query_max")
    assert qmin is not None and [round(v, 6) for v in qmin] == [-1.0, 0.0, -3.0], (
        f"report.query_min must be [-1.0, 0.0, -3.0], got {qmin}."
    )
    assert qmax is not None and [round(v, 6) for v in qmax] == [5.0, 1.5, 0.0], (
        f"report.query_max must be [5.0, 1.5, 0.0], got {qmax}."
    )

    exp_indices, exp_weight, exp_flagged = cull_expected((-1.0, 0.0, -3.0), (5.0, 1.5, 0.0))
    # Sanity: our oracle matches the documented expectation.
    assert exp_indices == REPORT_INDICES
    assert exp_weight == 123.0 and exp_flagged == 24

    assert list(report.get("visible_indices", [])) == REPORT_INDICES, (
        "report.visible_indices does not match the expected visible set."
    )
    assert report.get("visible_count") == 48, "report.visible_count must be 48."
    assert abs(float(report.get("weight_sum", 0.0)) - 123.0) <= 1e-6, (
        "report.weight_sum must be 123.0."
    )
    assert report.get("flagged_count") == 24, "report.flagged_count must be 24."


# --------------------------------------------------------------------------
# cull(): report box matches the documented result
# --------------------------------------------------------------------------
def test_cull_report_box(checker):
    entry = checker["culls"]["report_box"]
    assert list(entry["indices"]) == REPORT_INDICES, (
        f"cull(report box) indices mismatch: {entry['indices']}"
    )
    assert entry["count"] == 48, f"cull(report box) count must be 48, got {entry['count']}."
    assert abs(entry["weight_sum"] - 123.0) <= 1e-6, (
        f"cull(report box) weight_sum must be 123.0, got {entry['weight_sum']}."
    )
    assert entry["flagged_count"] == 24, (
        f"cull(report box) flagged_count must be 24, got {entry['flagged_count']}."
    )


# --------------------------------------------------------------------------
# cull(): every box (report + hidden) must match the independent oracle
# --------------------------------------------------------------------------
@pytest.mark.parametrize("name", [b[0] for b in BOXES])
def test_cull_matches_oracle(checker, name):
    box = next(b for b in BOXES if b[0] == name)
    _, bmin, bmax = box
    exp_indices, exp_weight, exp_flagged = cull_expected(bmin, bmax)

    entry = checker["culls"][name]
    assert sorted(entry["indices"]) == exp_indices, (
        f"cull({name}) indices mismatch. expected {exp_indices}, got {entry['indices']}."
    )
    assert list(entry["indices"]) == exp_indices, (
        f"cull({name}) indices must be sorted ascending, got {entry['indices']}."
    )
    assert entry["count"] == len(exp_indices), (
        f"cull({name}) count expected {len(exp_indices)}, got {entry['count']}."
    )
    assert abs(entry["weight_sum"] - exp_weight) <= 1e-6, (
        f"cull({name}) weight_sum expected {exp_weight}, got {entry['weight_sum']}."
    )
    assert entry["flagged_count"] == exp_flagged, (
        f"cull({name}) flagged_count expected {exp_flagged}, got {entry['flagged_count']}."
    )
