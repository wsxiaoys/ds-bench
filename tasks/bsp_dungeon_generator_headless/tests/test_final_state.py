import json
import os
import subprocess
import tempfile

import pytest

PROJECT_DIR = "/home/user/project"
RUN_SH = os.path.join(PROJECT_DIR, "run.sh")

MASK64 = (1 << 64) - 1
RUN_TIMEOUT = 900

# ---------------------------------------------------------------------------
# Independent reference implementation of the specification.
#
# RandomXS128 is libGDX's xorshift128+ PRNG. The port below reproduces the
# exact 64-bit sequence of com.badlogic.gdx.math.RandomXS128 (version 1.14.2),
# including murmurHash3 seeding and the rejection-sampling nextLong(n).
# ---------------------------------------------------------------------------


def _u64(x: int) -> int:
    return x & MASK64


def _s64(x: int) -> int:
    x &= MASK64
    return x - (1 << 64) if x >= (1 << 63) else x


class RandomXS128:
    def __init__(self, seed: int) -> None:
        self.seed0 = 0
        self.seed1 = 0
        self.set_seed(seed)

    @staticmethod
    def _murmur(x: int) -> int:
        x = _u64(x)
        x ^= x >> 33
        x = _u64(x * 0xFF51AFD7ED558CCD)
        x ^= x >> 33
        x = _u64(x * 0xC4CEB9FE1A85EC53)
        x ^= x >> 33
        return _u64(x)

    def set_seed(self, seed: int) -> None:
        # Java: murmurHash3(seed == 0 ? Long.MIN_VALUE : seed)
        s = seed if seed != 0 else -(1 << 63)
        seed0 = self._murmur(s)
        self.seed0 = seed0
        self.seed1 = self._murmur(seed0)

    def next_long(self) -> int:
        # Returns the unsigned 64-bit representation of the next value.
        s1 = self.seed0
        s0 = self.seed1
        self.seed0 = s0
        s1 = _u64(s1 ^ _u64(s1 << 23))
        self.seed1 = _u64(s1 ^ s0 ^ (s1 >> 17) ^ (s0 >> 26))
        return _u64(self.seed1 + s0)

    def next_long_bounded(self, n: int) -> int:
        assert n > 0
        while True:
            bits = self.next_long() >> 1
            value = bits % n
            t = bits - value + (n - 1)
            if _s64(t) >= 0:
                return value

    def next_int(self, n: int) -> int:
        return int(self.next_long_bounded(n))


def fnv1a64(data: bytes) -> int:
    h = 0xCBF29CE484222325
    for b in data:
        h ^= b
        h = _u64(h * 0x100000001B3)
    return h


def generate(seed, width, height, min_leaf, min_room, max_depth):
    rng = RandomXS128(seed)
    leaves = []  # leaf rects in pre-order
    rooms_preorder = []  # room per leaf, aligned with leaves

    def build(x, y, w, h, depth):
        can_v = w >= 2 * min_leaf
        can_h = h >= 2 * min_leaf
        do_split = depth < max_depth and (can_v or can_h)
        if not do_split:
            avail_w = w - 2
            avail_h = h - 2
            rw = min_room + rng.next_int(avail_w - min_room + 1)
            rh = min_room + rng.next_int(avail_h - min_room + 1)
            rx = (x + 1) + rng.next_int(avail_w - rw + 1)
            ry = (y + 1) + rng.next_int(avail_h - rh + 1)
            room = (rx, ry, rw, rh)
            node = {"leaf": True, "room": room}
            leaves.append((x, y, w, h))
            rooms_preorder.append(room)
            return node
        if can_v and not can_h:
            vertical = True
        elif can_h and not can_v:
            vertical = False
        else:
            vertical = rng.next_int(2) == 0
        if vertical:
            lw = min_leaf + rng.next_int(w - 2 * min_leaf + 1)
            c1 = build(x, y, lw, h, depth + 1)
            c2 = build(x + lw, y, w - lw, h, depth + 1)
        else:
            th = min_leaf + rng.next_int(h - 2 * min_leaf + 1)
            c1 = build(x, y, w, th, depth + 1)
            c2 = build(x, y + th, w, h - th, depth + 1)
        node = {"leaf": False, "children": (c1, c2), "room": c1["room"]}
        return node

    root = build(0, 0, width, height, 0)

    corridors = []

    def emit_corridors(node):
        if node["leaf"]:
            return
        c1, c2 = node["children"]
        a = c1["room"]
        b = c2["room"]
        ax = a[0] + a[2] // 2
        ay = a[1] + a[3] // 2
        bx = b[0] + b[2] // 2
        by = b[1] + b[3] // 2
        corridors.append([min(ax, bx), ay, max(ax, bx), ay])
        corridors.append([bx, min(ay, by), bx, max(ay, by)])
        emit_corridors(c1)
        emit_corridors(c2)

    emit_corridors(root)

    grid = [["#"] * width for _ in range(height)]
    for (rx, ry, rw, rh) in rooms_preorder:
        for yy in range(ry, ry + rh):
            for xx in range(rx, rx + rw):
                grid[yy][xx] = "."
    for (x1, y1, x2, y2) in corridors:
        for yy in range(y1, y2 + 1):
            for xx in range(x1, x2 + 1):
                grid[yy][xx] = "."

    map_text = "".join("".join(row) + "\n" for row in grid)
    map_bytes = map_text.encode("ascii")
    map_hash = format(fnv1a64(map_bytes), "016x")

    rooms_sorted = sorted(rooms_preorder, key=lambda r: (r[1], r[0]))

    expected = {
        "seed": seed,
        "width": width,
        "height": height,
        "leaf_count": len(leaves),
        "leaves": [list(l) for l in leaves],
        "rooms": [list(r) for r in rooms_sorted],
        "corridors": [list(c) for c in corridors],
        "map_hash": map_hash,
    }
    return expected, map_bytes


# ---------------------------------------------------------------------------
# Helpers to invoke the solution under test.
# ---------------------------------------------------------------------------

INPUT_KEYS = ["seed", "width", "height", "min_leaf", "min_room", "max_depth"]


def _write_input(path, params):
    lines = [f"{k} {params[k]}" for k in INPUT_KEYS]
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")


def run_case(params):
    work = tempfile.mkdtemp(prefix="bsp_")
    input_path = os.path.join(work, "input.txt")
    _write_input(input_path, params)
    out_path = os.path.join(work, "output.json")
    map_path = os.path.join(work, "map.txt")
    if os.path.exists(out_path):
        os.remove(out_path)
    if os.path.exists(map_path):
        os.remove(map_path)

    result = subprocess.run(
        ["bash", RUN_SH, input_path, work],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=RUN_TIMEOUT,
    )
    assert result.returncode == 0, (
        f"run.sh exited with code {result.returncode}.\n"
        f"STDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
    )
    assert os.path.isfile(out_path), f"Expected output.json at {out_path}"
    assert os.path.isfile(map_path), f"Expected map.txt at {map_path}"

    with open(out_path) as f:
        out = json.load(f)
    with open(map_path, "rb") as f:
        map_bytes = f.read()
    return out, map_bytes, work


def assert_matches(params):
    expected, expected_map = generate(
        params["seed"],
        params["width"],
        params["height"],
        params["min_leaf"],
        params["min_room"],
        params["max_depth"],
    )
    out, map_bytes, _ = run_case(params)

    for key in ["seed", "width", "height", "leaf_count"]:
        assert out.get(key) == expected[key], (
            f"output.json['{key}'] = {out.get(key)}, expected {expected[key]}"
        )
    assert out.get("leaves") == expected["leaves"], (
        "leaves list does not match reference (order/values must be identical)."
    )
    assert out.get("rooms") == expected["rooms"], (
        "rooms list does not match reference (must be sorted ascending by y then x)."
    )
    assert out.get("corridors") == expected["corridors"], (
        "corridors list does not match reference (pre-order, horizontal then "
        "vertical per internal node, normalized endpoints)."
    )
    assert out.get("map_hash") == expected["map_hash"], (
        f"map_hash = {out.get('map_hash')}, expected {expected['map_hash']}"
    )

    assert map_bytes == expected_map, (
        "map.txt is not byte-for-byte identical to the reference map."
    )

    # Structural invariants derived from the inputs.
    lines = map_bytes.split(b"\n")
    assert lines[-1] == b"", "map.txt must end with a trailing newline."
    rows = lines[:-1]
    assert len(rows) == params["height"], (
        f"map.txt has {len(rows)} rows, expected {params['height']}."
    )
    for row in rows:
        assert len(row) == params["width"], (
            f"map.txt row length {len(row)} != width {params['width']}."
        )
        assert set(row).issubset({ord('#'), ord('.')}), (
            "map.txt may only contain '#' and '.' characters."
        )

    # Every room lies within the grid and is entirely floor.
    grid_rows = [r.decode("ascii") for r in rows]
    for (rx, ry, rw, rh) in out["rooms"]:
        assert 0 <= rx and rx + rw <= params["width"], "Room out of horizontal bounds."
        assert 0 <= ry and ry + rh <= params["height"], "Room out of vertical bounds."
        for yy in range(ry, ry + rh):
            for xx in range(rx, rx + rw):
                assert grid_rows[yy][xx] == ".", (
                    f"Tile ({xx},{yy}) inside a room is not floor '.'."
                )

    # map_hash is the FNV-1a of the actual file bytes.
    assert format(fnv1a64(map_bytes), "016x") == out["map_hash"], (
        "map_hash does not match FNV-1a of the actual map.txt bytes."
    )
    return out, map_bytes


CASE_A = {"seed": 123456789, "width": 48, "height": 32,
          "min_leaf": 8, "min_room": 4, "max_depth": 4}
CASE_B = {"seed": -987654321, "width": 60, "height": 40,
          "min_leaf": 10, "min_room": 5, "max_depth": 5}
CASE_C = {"seed": 0, "width": 16, "height": 16,
          "min_leaf": 6, "min_room": 3, "max_depth": 2}


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_project_and_run_script_exist():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} missing."
    assert os.path.isfile(RUN_SH), f"Expected run script at {RUN_SH}."


def test_source_uses_headless_and_randomxs128():
    java_text = []
    for root, _dirs, files in os.walk(PROJECT_DIR):
        for name in files:
            if name.endswith(".java"):
                with open(os.path.join(root, name), "r", errors="ignore") as f:
                    java_text.append(f.read())
    combined = "\n".join(java_text)
    assert combined, "No Java source files found under the project."
    assert "HeadlessApplication" in combined, (
        "Solution source must run inside a libGDX HeadlessApplication."
    )
    assert "RandomXS128" in combined, (
        "Solution source must use com.badlogic.gdx.math.RandomXS128 for randomness."
    )


def test_build_declares_libgdx_dependencies():
    texts = []
    for root, _dirs, files in os.walk(PROJECT_DIR):
        for name in files:
            if name.endswith(".gradle") or name.endswith(".gradle.kts") \
                    or name == "gradle.properties" or name == "pom.xml":
                with open(os.path.join(root, name), "r", errors="ignore") as f:
                    texts.append(f.read())
    combined = "\n".join(texts)
    assert combined, "No Gradle/Maven build configuration found under the project."
    assert "com.badlogicgames.gdx" in combined, (
        "Build must declare libGDX (com.badlogicgames.gdx) dependencies."
    )
    assert "gdx-backend-headless" in combined, (
        "Build must depend on the libGDX headless backend (gdx-backend-headless)."
    )
    assert "1.14.2" in combined, (
        "Build must pin libGDX to version 1.14.2."
    )


@pytest.fixture(scope="session")
def case_a_result():
    return assert_matches(CASE_A)


def test_case_a_typical_dungeon(case_a_result):
    out, _map_bytes = case_a_result
    assert out["width"] == 48 and out["height"] == 32
    assert out["leaf_count"] == len(out["leaves"]) == len(out["rooms"])


def test_case_b_large_negative_seed():
    out, _ = assert_matches(CASE_B)
    assert out["width"] == 60 and out["height"] == 40


def test_case_c_seed_zero_edge():
    out, _ = assert_matches(CASE_C)
    assert out["seed"] == 0
    assert out["width"] == 16 and out["height"] == 16


def test_determinism_repeated_run(case_a_result):
    first_out, first_map = case_a_result
    second_out, second_map, _ = run_case(CASE_A)
    assert second_out == first_out, (
        "output.json differs between two runs of the same input; must be deterministic."
    )
    assert second_map == first_map, (
        "map.txt differs between two runs of the same input; must be deterministic."
    )
