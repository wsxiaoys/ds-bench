import json
import os
import subprocess
import textwrap

PROJECT_DIR = "/home/user/myproject"
HARNESS_PATH = os.path.join(PROJECT_DIR, "zealt_harness.gd")
LEVEL_JSON_PATH = os.path.join(PROJECT_DIR, "data", "level.json")

HARNESS_SCRIPT = textwrap.dedent(
    """
    extends SceneTree

    func _fail(msg: String) -> void:
        print("ZEALT_RESULT: FAIL " + msg)
        quit(1)

    func _color_distinct(a: Color, b: Color) -> bool:
        var eps := 0.01
        return absf(a.r - b.r) > eps or absf(a.g - b.g) > eps or absf(a.b - b.b) > eps

    func _init() -> void:
        # --- Parse level JSON directly ---
        if not FileAccess.file_exists("res://data/level.json"):
            _fail("res://data/level.json not found")
            return
        var f := FileAccess.open("res://data/level.json", FileAccess.READ)
        if f == null:
            _fail("could not open res://data/level.json")
            return
        var raw := f.get_as_text()
        f.close()
        var parsed = JSON.parse_string(raw)
        if typeof(parsed) != TYPE_DICTIONARY:
            _fail("level.json must be a JSON object at the top level")
            return
        if not parsed.has("cells"):
            _fail("level.json missing 'cells' key")
            return
        var cells_raw = parsed["cells"]
        if typeof(cells_raw) != TYPE_ARRAY:
            _fail("level.json 'cells' must be an array")
            return
        if cells_raw.size() < 8:
            _fail("level.json must declare at least 8 cells (got %d)" % cells_raw.size())
            return
        var cells: Array = []
        var ids_seen := {}
        var ys_seen := {}
        for c in cells_raw:
            if typeof(c) != TYPE_DICTIONARY:
                _fail("each cell must be an object")
                return
            for k in ["id", "x", "y", "z"]:
                if not c.has(k):
                    _fail("cell missing key %s" % k)
                    return
            var cid: int = int(c["id"])
            var cx: int = int(c["x"])
            var cy: int = int(c["y"])
            var cz: int = int(c["z"])
            if cid != 0 and cid != 1 and cid != 2:
                _fail("cell id %d not in {0,1,2}" % cid)
                return
            ids_seen[cid] = true
            ys_seen[cy] = true
            cells.append({"id": cid, "x": cx, "y": cy, "z": cz})
        for required in [0, 1, 2]:
            if not ids_seen.has(required):
                _fail("level.json must use every id in {0,1,2}; missing %d" % required)
                return
        if ys_seen.size() < 2:
            _fail("level.json must use at least 2 distinct y levels; got %d" % ys_seen.size())
            return

        # --- Load scene and instance LevelBuilder ---
        if not FileAccess.file_exists("res://scenes/Main.tscn"):
            _fail("res://scenes/Main.tscn not found")
            return
        var packed = load("res://scenes/Main.tscn")
        if packed == null or not (packed is PackedScene):
            _fail("res://scenes/Main.tscn failed to load as PackedScene")
            return
        var instance = packed.instantiate()
        if instance == null:
            _fail("failed to instantiate Main.tscn")
            return
        get_root().add_child(instance)

        # --- Verify GridMap child path ---
        if not instance.has_node("GridMap"):
            _fail("instance has no child named 'GridMap'")
            return
        var grid_map = instance.get_node("GridMap")
        if not (grid_map is GridMap):
            _fail("'GridMap' child is not a GridMap node (got %s)" % grid_map.get_class())
            return

        # --- Verify public method signatures ---
        for m in ["build", "place", "remove", "get_item"]:
            if not instance.has_method(m):
                _fail("LevelBuilder missing method '%s'" % m)
                return

        # --- Call build() ---
        instance.build()

        # --- Verify MeshLibrary content ---
        var lib = grid_map.mesh_library
        if lib == null or not (lib is MeshLibrary):
            _fail("GridMap.mesh_library is not a MeshLibrary after build()")
            return
        var item_list = lib.get_item_list()
        for required in [0, 1, 2]:
            if not (required in item_list):
                _fail("MeshLibrary missing item id %d (have %s)" % [required, str(item_list)])
                return
        var colors: Array = []
        for id in [0, 1, 2]:
            var mesh = lib.get_item_mesh(id)
            if mesh == null:
                _fail("MeshLibrary item %d has no mesh" % id)
                return
            var mat = mesh.surface_get_material(0)
            if mat == null:
                _fail("MeshLibrary item %d mesh has no surface 0 material" % id)
                return
            if not (mat is StandardMaterial3D):
                _fail("MeshLibrary item %d surface material is not StandardMaterial3D (got %s)" % [id, mat.get_class()])
                return
            colors.append(mat.albedo_color)
        if not _color_distinct(colors[0], colors[1]):
            _fail("MeshLibrary item 0 and 1 albedo colors are not distinct")
            return
        if not _color_distinct(colors[0], colors[2]):
            _fail("MeshLibrary item 0 and 2 albedo colors are not distinct")
            return
        if not _color_distinct(colors[1], colors[2]):
            _fail("MeshLibrary item 1 and 2 albedo colors are not distinct")
            return

        # --- Verify every JSON cell is present in the GridMap ---
        var max_x := -1000000
        var max_y := -1000000
        var max_z := -1000000
        var coord_set := {}
        for cell in cells:
            var key := "%d,%d,%d" % [cell.x, cell.y, cell.z]
            coord_set[key] = true
            if cell.x > max_x:
                max_x = cell.x
            if cell.y > max_y:
                max_y = cell.y
            if cell.z > max_z:
                max_z = cell.z
            var got: int = grid_map.get_cell_item(Vector3i(cell.x, cell.y, cell.z))
            if got != cell.id:
                _fail("GridMap.get_cell_item(%d,%d,%d)=%d expected %d" % [cell.x, cell.y, cell.z, got, cell.id])
                return
            var got2: int = int(instance.get_item(cell.x, cell.y, cell.z))
            if got2 != cell.id:
                _fail("LevelBuilder.get_item(%d,%d,%d)=%d expected %d" % [cell.x, cell.y, cell.z, got2, cell.id])
                return

        # --- place() at an empty coordinate ---
        var px := max_x + 5
        var py := max_y + 5
        var pz := max_z + 5
        var key2 := "%d,%d,%d" % [px, py, pz]
        if coord_set.has(key2):
            _fail("internal: chosen 'empty' coordinate %s is in JSON" % key2)
            return
        if grid_map.get_cell_item(Vector3i(px, py, pz)) != -1:
            _fail("expected empty cell at (%d,%d,%d) before place, got %d" % [px, py, pz, grid_map.get_cell_item(Vector3i(px, py, pz))])
            return
        instance.place(2, px, py, pz)
        if grid_map.get_cell_item(Vector3i(px, py, pz)) != 2:
            _fail("after place(2,%d,%d,%d), GridMap.get_cell_item returned %d" % [px, py, pz, grid_map.get_cell_item(Vector3i(px, py, pz))])
            return
        if int(instance.get_item(px, py, pz)) != 2:
            _fail("after place(2,%d,%d,%d), LevelBuilder.get_item returned %d" % [px, py, pz, int(instance.get_item(px, py, pz))])
            return

        # --- remove() a populated cell ---
        var first = cells[0]
        instance.remove(first.x, first.y, first.z)
        if grid_map.get_cell_item(Vector3i(first.x, first.y, first.z)) != -1:
            _fail("after remove(%d,%d,%d), GridMap.get_cell_item returned %d" % [first.x, first.y, first.z, grid_map.get_cell_item(Vector3i(first.x, first.y, first.z))])
            return
        if int(instance.get_item(first.x, first.y, first.z)) != -1:
            _fail("after remove(%d,%d,%d), LevelBuilder.get_item returned %d" % [first.x, first.y, first.z, int(instance.get_item(first.x, first.y, first.z))])
            return

        print("ZEALT_RESULT: OK")
        quit(0)
    """
).strip() + "\n"


def _run_godot(args: list[str], timeout: int = 240) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["godot", "--headless", *args],
        capture_output=True,
        text=True,
        timeout=timeout,
        cwd=PROJECT_DIR,
    )


def test_project_godot_file_exists():
    project_godot = os.path.join(PROJECT_DIR, "project.godot")
    assert os.path.isfile(project_godot), (
        f"project.godot not found at {project_godot}; the project root is not a valid Godot 4 project."
    )


def test_level_builder_script_exists():
    path = os.path.join(PROJECT_DIR, "scripts", "LevelBuilder.gd")
    assert os.path.isfile(path), f"Required GDScript missing at {path}"


def test_main_scene_exists():
    path = os.path.join(PROJECT_DIR, "scenes", "Main.tscn")
    assert os.path.isfile(path), f"Required Main scene missing at {path}"


def test_level_json_exists_and_is_well_formed():
    assert os.path.isfile(LEVEL_JSON_PATH), f"Required level layout missing at {LEVEL_JSON_PATH}"
    with open(LEVEL_JSON_PATH, "r") as f:
        data = json.load(f)
    assert isinstance(data, dict), "level.json must be a JSON object"
    assert "cells" in data and isinstance(data["cells"], list), "level.json must contain a 'cells' array"
    cells = data["cells"]
    assert len(cells) >= 8, f"level.json must declare at least 8 cells, got {len(cells)}"
    ids = set()
    ys = set()
    for c in cells:
        assert isinstance(c, dict), "each cell must be a JSON object"
        for k in ("id", "x", "y", "z"):
            assert k in c, f"cell missing required key '{k}'"
        assert c["id"] in (0, 1, 2), f"cell id {c['id']} must be in {{0,1,2}}"
        ids.add(c["id"])
        ys.add(c["y"])
    assert ids == {0, 1, 2}, f"level.json must use every id in {{0,1,2}}, got {ids}"
    assert len(ys) >= 2, f"level.json must use at least 2 distinct y levels, got {ys}"


def test_project_imports_cleanly():
    result = _run_godot(["--path", PROJECT_DIR, "--import"], timeout=180)
    assert result.returncode == 0, (
        f"`godot --headless --import` failed (exit {result.returncode}).\n"
        f"stdout:\n{result.stdout}\n"
        f"stderr:\n{result.stderr}"
    )


def test_harness_passes():
    os.makedirs(PROJECT_DIR, exist_ok=True)
    with open(HARNESS_PATH, "w") as f:
        f.write(HARNESS_SCRIPT)

    try:
        result = _run_godot(
            ["--path", PROJECT_DIR, "--script", "res://zealt_harness.gd"],
            timeout=240,
        )
    finally:
        try:
            os.remove(HARNESS_PATH)
        except OSError:
            pass

    combined = (result.stdout or "") + "\n" + (result.stderr or "")
    assert "ZEALT_RESULT: OK" in combined, (
        f"GridMap level builder harness did not report success.\n"
        f"exit code: {result.returncode}\n"
        f"stdout:\n{result.stdout}\n"
        f"stderr:\n{result.stderr}"
    )
    assert result.returncode == 0, (
        f"Harness exited with non-zero status {result.returncode}.\n"
        f"stdout:\n{result.stdout}\n"
        f"stderr:\n{result.stderr}"
    )
