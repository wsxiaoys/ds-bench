import os
import subprocess
import textwrap

PROJECT_DIR = "/home/user/myproject"
HARNESS_PATH = os.path.join(PROJECT_DIR, "zealt_harness.gd")

HARNESS_SCRIPT = textwrap.dedent(
    """
    extends SceneTree

    func _hash_layer(layer: TileMapLayer) -> int:
        var cells: Array = layer.get_used_cells()
        var items: Array = []
        for c in cells:
            items.append([int(c.x), int(c.y), int(layer.get_cell_source_id(c))])
        items.sort()
        return items.hash()

    func _fail(msg: String) -> void:
        print("ZEALT_RESULT: FAIL " + msg)
        quit(1)

    func _init() -> void:
        var tileset_res = load("res://tilesets/dungeon.tres")
        if tileset_res == null or not (tileset_res is TileSet):
            _fail("tilesets/dungeon.tres did not load as TileSet")
            return
        var src_count: int = tileset_res.get_source_count()
        if src_count < 3:
            _fail("TileSet has fewer than 3 sources (%d)" % src_count)
            return
        var src_ids: Array = []
        for i in range(src_count):
            src_ids.append(tileset_res.get_source_id(i))
        for required in [0, 1, 2]:
            if not (required in src_ids):
                _fail("TileSet missing source_id %d (have %s)" % [required, str(src_ids)])
                return

        var gen_script = load("res://scripts/DungeonGenerator.gd")
        if gen_script == null:
            _fail("Failed to load scripts/DungeonGenerator.gd")
            return
        var gen = gen_script.new()
        if gen == null:
            _fail("Failed to instantiate DungeonGenerator")
            return

        var W: int = int(gen.width)
        var H: int = int(gen.height)
        if W < 8 or H < 8:
            _fail("Unexpectedly small grid: %dx%d" % [W, H])
            return

        var layer1 := TileMapLayer.new()
        layer1.tile_set = tileset_res
        gen.seed = 12345
        gen.generate(layer1)

        # Edge cells must all be wall (source_id 1).
        for x in range(W):
            if layer1.get_cell_source_id(Vector2i(x, 0)) != 1:
                _fail("edge top (%d,0) not wall" % x)
                return
            if layer1.get_cell_source_id(Vector2i(x, H - 1)) != 1:
                _fail("edge bottom (%d,%d) not wall" % [x, H - 1])
                return
        for y in range(H):
            if layer1.get_cell_source_id(Vector2i(0, y)) != 1:
                _fail("edge left (0,%d) not wall" % y)
                return
            if layer1.get_cell_source_id(Vector2i(W - 1, y)) != 1:
                _fail("edge right (%d,%d) not wall" % [W - 1, y])
                return

        var rooms: Array = gen.find_rooms()
        if rooms.size() < 3:
            _fail("find_rooms() returned %d rooms (need >= 3)" % rooms.size())
            return
        var interior := Rect2i(1, 1, W - 2, H - 2)
        for i in range(rooms.size()):
            var r: Rect2i = rooms[i]
            if r.size.x <= 0 or r.size.y <= 0:
                _fail("room %d has non-positive size %s" % [i, str(r)])
                return
            if not interior.encloses(r):
                _fail("room %d %s not contained in interior %s" % [i, str(r), str(interior)])
                return
            for j in range(i + 1, rooms.size()):
                if r.intersects(rooms[j]):
                    _fail("rooms %d %s and %d %s overlap" % [i, str(r), j, str(rooms[j])])
                    return

        var sum_area: int = 0
        for r in rooms:
            sum_area += int(r.size.x) * int(r.size.y)
        var floor_count: int = int(gen.count_floor_tiles(layer1))
        if floor_count < sum_area:
            _fail("count_floor_tiles %d < sum room area %d" % [floor_count, sum_area])
            return

        var h1: int = _hash_layer(layer1)

        # Determinism: run again with same seed in a fresh layer.
        var layer2 := TileMapLayer.new()
        layer2.tile_set = tileset_res
        gen.seed = 12345
        gen.generate(layer2)
        var h2: int = _hash_layer(layer2)
        if h1 != h2:
            _fail("non-deterministic: seed 12345 produced different hashes (%d vs %d)" % [h1, h2])
            return

        # Different seed must yield a different hash.
        var layer3 := TileMapLayer.new()
        layer3.tile_set = tileset_res
        gen.seed = 99
        gen.generate(layer3)
        var h3: int = _hash_layer(layer3)
        if h1 == h3:
            _fail("seed 99 produced same hash as seed 12345")
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


def test_tileset_file_exists():
    path = os.path.join(PROJECT_DIR, "tilesets", "dungeon.tres")
    assert os.path.isfile(path), f"Required TileSet resource missing at {path}"


def test_dungeon_generator_script_exists():
    path = os.path.join(PROJECT_DIR, "scripts", "DungeonGenerator.gd")
    assert os.path.isfile(path), f"Required GDScript missing at {path}"


def test_main_scene_exists():
    path = os.path.join(PROJECT_DIR, "scenes", "Main.tscn")
    assert os.path.isfile(path), f"Required Main scene missing at {path}"


def test_project_imports_cleanly():
    # Force Godot to import the project; failing imports here usually mean a broken
    # project.godot, missing dependencies, or unparseable resources.
    result = _run_godot(["--path", PROJECT_DIR, "--import"], timeout=180)
    assert result.returncode == 0, (
        f"`godot --headless --import` failed (exit {result.returncode}).\n"
        f"stdout:\n{result.stdout}\n"
        f"stderr:\n{result.stderr}"
    )


def test_harness_passes():
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
        f"Dungeon generator harness did not report success.\n"
        f"exit code: {result.returncode}\n"
        f"stdout:\n{result.stdout}\n"
        f"stderr:\n{result.stderr}"
    )
    assert result.returncode == 0, (
        f"Harness exited with non-zero status {result.returncode}.\n"
        f"stdout:\n{result.stdout}\n"
        f"stderr:\n{result.stderr}"
    )
