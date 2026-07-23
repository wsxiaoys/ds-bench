import os
import re
import random
import subprocess
import tempfile

import pytest

PROJECT_DIR = "/home/user/quadtree-broadphase"
GRADLEW = os.path.join(PROJECT_DIR, "gradlew")

# Fixed task constants.
WORLD = (0.0, 0.0, 1024.0, 1024.0)  # minX, minY, maxX, maxY
CAPACITY = 3
MAX_DEPTH = 6

BUILD_TIMEOUT = 900
RUN_TIMEOUT = 300


# --------------------------------------------------------------------------- #
# Independent reference oracle implementing the exact specification.
# --------------------------------------------------------------------------- #
class Entity:
    __slots__ = ("id", "cx", "cy", "hx", "hy", "vx", "vy")

    def __init__(self, id, cx, cy, hx, hy, vx, vy):
        self.id = id
        self.cx = float(cx)
        self.cy = float(cy)
        self.hx = float(hx)
        self.hy = float(hy)
        self.vx = float(vx)
        self.vy = float(vy)

    def box(self):
        return (self.cx - self.hx, self.cx + self.hx, self.cy - self.hy, self.cy + self.hy)


class Node:
    __slots__ = ("minX", "minY", "maxX", "maxY", "depth", "entities", "children")

    def __init__(self, minX, minY, maxX, maxY, depth):
        self.minX = minX
        self.minY = minY
        self.maxX = maxX
        self.maxY = maxY
        self.depth = depth
        self.entities = []
        self.children = None  # list [NW, NE, SW, SE] or None


def _child_bounds(node):
    midX = (node.minX + node.maxX) / 2.0
    midY = (node.minY + node.maxY) / 2.0
    # order: NW, NE, SW, SE  (y-up: North = larger y)
    nw = (node.minX, midY, midX, node.maxY)
    ne = (midX, midY, node.maxX, node.maxY)
    sw = (node.minX, node.minY, midX, midY)
    se = (midX, node.minY, node.maxX, midY)
    return [nw, ne, sw, se]


def _fully_contains(bounds, box):
    minX, minY, maxX, maxY = bounds
    bMinX, bMaxX, bMinY, bMaxY = box
    return bMinX >= minX and bMaxX <= maxX and bMinY >= minY and bMaxY <= maxY


def _insert(node, ent):
    b = ent.box()
    if node.children is not None:
        for child in node.children:
            if _fully_contains((child.minX, child.minY, child.maxX, child.maxY), b):
                _insert(child, ent)
                return
        node.entities.append(ent)
        return
    node.entities.append(ent)
    if len(node.entities) > CAPACITY and node.depth < MAX_DEPTH:
        _subdivide(node)


def _subdivide(node):
    cbs = _child_bounds(node)
    node.children = [Node(b[0], b[1], b[2], b[3], node.depth + 1) for b in cbs]
    ents = node.entities
    node.entities = []
    for e in ents:  # current stored order == insertion order
        _insert(node, e)


def _build_tree(entities):
    root = Node(WORLD[0], WORLD[1], WORLD[2], WORLD[3], 0)
    for e in entities:
        _insert(root, e)
    return root


def _count_candidates(node, ancestors_count):
    n = len(node.entities)
    k = n * (n - 1) // 2
    k += n * ancestors_count
    if node.children is not None:
        for child in node.children:
            k += _count_candidates(child, ancestors_count + n)
    return k


def _signature_tokens(node):
    tok = ("N" if node.children is not None else "L") + str(len(node.entities))
    toks = [tok]
    if node.children is not None:
        for child in node.children:
            toks.extend(_signature_tokens(child))
    return toks


def _boxes_overlap(a, b):
    aMinX, aMaxX, aMinY, aMaxY = a
    bMinX, bMaxX, bMinY, bMaxY = b
    return aMinX < bMaxX and aMaxX > bMinX and aMinY < bMaxY and aMaxY > bMinY


def _overlapping_pairs(entities):
    pairs = []
    n = len(entities)
    for i in range(n):
        for j in range(i + 1, n):
            if _boxes_overlap(entities[i].box(), entities[j].box()):
                a, b = entities[i].id, entities[j].id
                if a > b:
                    a, b = b, a
                pairs.append((a, b))
    pairs.sort()
    return pairs


def oracle(entities, num_ticks):
    """Return list of ticks; each tick is a dict {K, sig(list of tokens), pairs(list of (a,b))}."""
    result = []
    for _ in range(num_ticks):
        for e in entities:
            e.cx += e.vx
            e.cy += e.vy
        root = _build_tree(entities)
        result.append(
            {
                "K": _count_candidates(root, 0),
                "sig": _signature_tokens(root),
                "pairs": _overlapping_pairs(entities),
            }
        )
    return result


def _make_input(entities, num_ticks):
    lines = [f"{len(entities)} {num_ticks}"]
    for e in entities:
        lines.append(
            f"{e.id} {int(e.cx)} {int(e.cy)} {int(e.hx)} {int(e.hy)} {int(e.vx)} {int(e.vy)}"
        )
    return "\n".join(lines) + "\n"


# --------------------------------------------------------------------------- #
# Tolerant-but-strict parser for the program's output file.
# Extracts, in order, tuples (tick_number, K, sig_tokens, pairs_in_order).
# Blank lines are ignored; content and ordering are enforced.
# --------------------------------------------------------------------------- #
_TICK_RE = re.compile(r"^TICK\s+(\d+)\s*$")
_CAND_RE = re.compile(r"^CANDIDATES\s+(\d+)\s*$")
_TREE_RE = re.compile(r"^TREE\s+(.+?)\s*$")
_PAIR_RE = re.compile(r"^(\d+),(\d+)\s*$")


def parse_output(text):
    lines = [ln.rstrip("\r") for ln in text.split("\n")]
    ticks = []
    i = 0
    n = len(lines)
    while i < n:
        line = lines[i]
        if line.strip() == "":
            i += 1
            continue
        m = _TICK_RE.match(line)
        assert m is not None, f"Expected a 'TICK <n>' header, got: {line!r}"
        tnum = int(m.group(1))
        i += 1
        # skip blanks
        while i < n and lines[i].strip() == "":
            i += 1
        assert i < n, "Output ended before CANDIDATES line."
        mc = _CAND_RE.match(lines[i])
        assert mc is not None, f"Expected 'CANDIDATES <n>', got: {lines[i]!r}"
        k = int(mc.group(1))
        i += 1
        while i < n and lines[i].strip() == "":
            i += 1
        assert i < n, "Output ended before TREE line."
        mt = _TREE_RE.match(lines[i])
        assert mt is not None, f"Expected 'TREE <signature>', got: {lines[i]!r}"
        sig = mt.group(1).split()
        i += 1
        pairs = []
        while i < n:
            if lines[i].strip() == "":
                i += 1
                continue
            if _TICK_RE.match(lines[i]):
                break
            mp = _PAIR_RE.match(lines[i])
            assert mp is not None, f"Expected 'idA,idB' pair line, got: {lines[i]!r}"
            pairs.append((int(mp.group(1)), int(mp.group(2))))
            i += 1
        ticks.append((tnum, k, sig, pairs))
    return ticks


# --------------------------------------------------------------------------- #
# Program execution helpers.
# --------------------------------------------------------------------------- #
def _run_program(input_text):
    workdir = tempfile.mkdtemp(prefix="qtcase_")
    in_path = os.path.join(workdir, "in.txt")
    out_path = os.path.join(workdir, "out.txt")
    with open(in_path, "w") as f:
        f.write(input_text)
    if os.path.exists(out_path):
        os.remove(out_path)
    proc = subprocess.run(
        [
            "./gradlew",
            "--no-daemon",
            "--console=plain",
            "--quiet",
            ":headless:run",
            f"--args={in_path} {out_path}",
        ],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=RUN_TIMEOUT,
    )
    assert proc.returncode == 0, (
        f"Program run failed (exit {proc.returncode}).\nSTDOUT:\n{proc.stdout}\nSTDERR:\n{proc.stderr}"
    )
    assert os.path.isfile(out_path), (
        f"Output file was not created at {out_path}.\nSTDOUT:\n{proc.stdout}\nSTDERR:\n{proc.stderr}"
    )
    with open(out_path) as f:
        return f.read()


def _assert_matches_oracle(entities, num_ticks):
    input_text = _make_input(entities, num_ticks)
    # oracle mutates entities; build a fresh copy for it.
    oracle_entities = [Entity(e.id, e.cx, e.cy, e.hx, e.hy, e.vx, e.vy) for e in entities]
    expected = oracle(oracle_entities, num_ticks)
    actual = parse_output(_run_program(input_text))

    assert len(actual) == len(expected), (
        f"Expected {len(expected)} tick blocks, got {len(actual)}."
    )
    for idx, (exp, act) in enumerate(zip(expected, actual), start=1):
        tnum, k, sig, pairs = act
        assert tnum == idx, f"Tick blocks must be numbered 1..N in order; block {idx} had 'TICK {tnum}'."
        assert k == exp["K"], (
            f"Tick {idx}: CANDIDATES mismatch. Expected {exp['K']}, got {k}."
        )
        assert sig == exp["sig"], (
            f"Tick {idx}: TREE signature mismatch.\nExpected: {' '.join(exp['sig'])}\nGot:      {' '.join(sig)}"
        )
        assert pairs == exp["pairs"], (
            f"Tick {idx}: overlapping pair list mismatch (must be sorted, idA<idB).\n"
            f"Expected: {exp['pairs']}\nGot:      {pairs}"
        )


# --------------------------------------------------------------------------- #
# Build fixture.
# --------------------------------------------------------------------------- #
@pytest.fixture(scope="session")
def gradle_built():
    assert os.path.isfile(GRADLEW), f"Gradle wrapper not found at {GRADLEW}."
    proc = subprocess.run(
        ["./gradlew", "--no-daemon", "--console=plain", ":headless:assemble"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=BUILD_TIMEOUT,
    )
    print("=== gradle assemble STDOUT ===")
    print(proc.stdout)
    print("=== gradle assemble STDERR ===")
    print(proc.stderr)
    assert proc.returncode == 0, (
        f"Gradle headless module failed to build (exit {proc.returncode}). See logs above."
    )
    return True


# --------------------------------------------------------------------------- #
# Secondary (non-runtime) signal: the headless backend + pinned version.
# --------------------------------------------------------------------------- #
def test_uses_headless_backend_and_pinned_version():
    found_headless = False
    found_version = False
    for root, _dirs, files in os.walk(PROJECT_DIR):
        if "/.gradle" in root or "/build" in root or "/.git" in root:
            continue
        for name in files:
            if name.endswith((".gradle", ".kts", ".toml", ".properties")):
                try:
                    with open(os.path.join(root, name)) as f:
                        content = f.read()
                except OSError:
                    continue
                if "gdx-backend-headless" in content:
                    found_headless = True
                if "1.14.2" in content:
                    found_version = True
    assert found_headless, "Project must declare the libGDX headless backend (gdx-backend-headless)."
    assert found_version, "Project must pin libGDX version 1.14.2."


# --------------------------------------------------------------------------- #
# Case A — strict edge touch vs overlap, and tick integration.
# --------------------------------------------------------------------------- #
def test_case_a_edge_touch_then_overlap(gradle_built):
    entities = [
        Entity(1, 100, 100, 10, 10, 5, 0),
        Entity(2, 130, 100, 10, 10, -5, 0),
    ]
    input_text = _make_input(entities, 2)
    actual = parse_output(_run_program(input_text))
    assert len(actual) == 2, f"Expected 2 tick blocks, got {len(actual)}."

    t1 = actual[0]
    assert t1[0] == 1 and t1[1] == 1 and t1[2] == ["L2"], f"Tick 1 header wrong: {t1}"
    assert t1[3] == [], f"Tick 1 should have no overlapping pairs (edge-touch only), got {t1[3]}"

    t2 = actual[1]
    assert t2[0] == 2 and t2[1] == 1 and t2[2] == ["L2"], f"Tick 2 header wrong: {t2}"
    assert t2[3] == [(1, 2)], f"Tick 2 should report exactly pair (1,2), got {t2[3]}"


# --------------------------------------------------------------------------- #
# Case B — cascading nested subdivision, broadphase prunes to zero candidates.
# --------------------------------------------------------------------------- #
def test_case_b_nested_subdivision(gradle_built):
    entities = [
        Entity(1, 100, 100, 1, 1, 0, 0),
        Entity(2, 200, 100, 1, 1, 0, 0),
        Entity(3, 100, 200, 1, 1, 0, 0),
        Entity(4, 200, 200, 1, 1, 0, 0),
    ]
    input_text = _make_input(entities, 1)
    actual = parse_output(_run_program(input_text))
    assert len(actual) == 1, f"Expected 1 tick block, got {len(actual)}."
    tnum, k, sig, pairs = actual[0]
    assert tnum == 1, f"Expected TICK 1, got {tnum}."
    assert k == 0, f"Expected CANDIDATES 0 (all entities in disjoint sibling leaves), got {k}."
    expected_sig = "N0 L0 L0 N0 L0 L0 N0 L1 L1 L1 L1 L0 L0".split()
    assert sig == expected_sig, (
        f"TREE signature mismatch.\nExpected: {' '.join(expected_sig)}\nGot:      {' '.join(sig)}"
    )
    assert pairs == [], f"Expected no overlapping pairs, got {pairs}"


# --------------------------------------------------------------------------- #
# Case C1 — entity extending beyond world bounds stays at the root.
# --------------------------------------------------------------------------- #
def test_case_c_out_of_bounds_and_multipair(gradle_built):
    entities = [
        # Two overlapping entities that straddle the world center (kept at root).
        Entity(10, 512, 512, 40, 40, 0, 0),
        Entity(11, 530, 500, 40, 40, 0, 0),
        # Entity extending beyond the world bounds -> must remain at the root.
        Entity(12, 1020, 1020, 30, 30, 0, 0),
        # A far-away entity in a distinct quadrant.
        Entity(13, 100, 900, 5, 5, 0, 0),
    ]
    _assert_matches_oracle(entities, 1)


# --------------------------------------------------------------------------- #
# Randomized stress vs independent oracle (deterministic seeds).
# --------------------------------------------------------------------------- #
@pytest.mark.parametrize("seed", [1, 42, 2024])
def test_randomized_stress_matches_oracle(gradle_built, seed):
    rng = random.Random(seed)
    num_entities = rng.randint(12, 40)
    num_ticks = rng.randint(2, 5)
    entities = []
    used_ids = set()
    for _ in range(num_entities):
        while True:
            eid = rng.randint(0, 999)
            if eid not in used_ids:
                used_ids.add(eid)
                break
        # Clustered coordinates (to force deep subdivision) plus occasional
        # out-of-range positions/velocities.
        cx = rng.randint(-50, 1074)
        cy = rng.randint(-50, 1074)
        hx = rng.randint(1, 24)
        hy = rng.randint(1, 24)
        vx = rng.randint(-40, 40)
        vy = rng.randint(-40, 40)
        entities.append(Entity(eid, cx, cy, hx, hy, vx, vy))
    _assert_matches_oracle(entities, num_ticks)


# --------------------------------------------------------------------------- #
# Dense cluster stress: many entities packed into a tiny region to exercise
# capacity/max-depth limits and parent-retention of straddlers.
# --------------------------------------------------------------------------- #
def test_dense_cluster_matches_oracle(gradle_built):
    rng = random.Random(9001)
    entities = []
    for i in range(30):
        cx = rng.randint(120, 140)
        cy = rng.randint(120, 140)
        entities.append(Entity(i, cx, cy, rng.randint(1, 8), rng.randint(1, 8), 0, 0))
    _assert_matches_oracle(entities, 1)
