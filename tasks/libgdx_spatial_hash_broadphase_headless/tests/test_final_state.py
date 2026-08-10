import math
import os
import re
import subprocess

import pytest

PROJECT_DIR = "/home/user/project"
GRADLE_TIMEOUT = 900
FLOAT_TOL = 1e-2
COORD_RE = re.compile(r"^-?\d+\.\d{5}$")


# --------------------------------------------------------------------------- #
# Reference implementation of the exact task specification (double precision). #
# --------------------------------------------------------------------------- #
def _reference(text):
    toks = text.split()
    pos = [0]

    def nf():
        v = float(toks[pos[0]])
        pos[0] += 1
        return v

    def ni():
        v = int(float(toks[pos[0]]))
        pos[0] += 1
        return v

    W = nf()
    H = nf()
    C = nf()
    DT = nf()
    T = ni()
    E = nf()
    K = ni()
    checkpoints = [ni() for _ in range(K)]
    checkpoint_set = set(checkpoints)
    N = ni()

    ids = []
    circ = {}  # id -> [x, y, vx, vy, r]
    for _ in range(N):
        cid = ni()
        x = nf()
        y = nf()
        vx = nf()
        vy = nf()
        r = nf()
        ids.append(cid)
        circ[cid] = [x, y, vx, vy, r]

    outputs = []

    for tick in range(1, T + 1):
        # Step 1: integrate.
        for cid in ids:
            c = circ[cid]
            c[0] += c[2] * DT
            c[1] += c[3] * DT
        # Step 2: walls (x then y).
        for cid in ids:
            c = circ[cid]
            x, y, vx, vy, r = c
            if x - r < 0:
                x = r
                if vx < 0:
                    vx = -vx * E
            if x + r > W:
                x = W - r
                if vx > 0:
                    vx = -vx * E
            if y - r < 0:
                y = r
                if vy < 0:
                    vy = -vy * E
            if y + r > H:
                y = H - r
                if vy > 0:
                    vy = -vy * E
            c[0], c[1], c[2], c[3] = x, y, vx, vy
        # Step 3: rebuild spatial hash.
        cell_map = {}
        for cid in ids:
            c = circ[cid]
            x, y, r = c[0], c[1], c[4]
            cx0 = int(math.floor((x - r) / C))
            cx1 = int(math.floor((x + r) / C))
            cy0 = int(math.floor((y - r) / C))
            cy1 = int(math.floor((y + r) / C))
            for cx in range(cx0, cx1 + 1):
                for cy in range(cy0, cy1 + 1):
                    cell_map.setdefault((cx, cy), []).append(cid)
        # Step 4: candidate pairs (deduplicated) + narrow phase (frozen snapshot).
        candidates = set()
        for members in cell_map.values():
            for a_i in range(len(members)):
                for b_i in range(a_i + 1, len(members)):
                    a = members[a_i]
                    b = members[b_i]
                    lo, hi = (a, b) if a < b else (b, a)
                    candidates.add((lo, hi))
        checks = len(candidates)
        colliding = set()
        for (a, b) in candidates:
            ca = circ[a]
            cb = circ[b]
            dx = cb[0] - ca[0]
            dy = cb[1] - ca[1]
            rs = ca[4] + cb[4]
            if dx * dx + dy * dy < rs * rs:
                colliding.add((a, b))
        # Step 5: resolution in ascending pair-id order.
        for (a, b) in sorted(colliding):
            ca = circ[a]
            cb = circ[b]
            ra = ca[4]
            rb = cb[4]
            dx = cb[0] - ca[0]
            dy = cb[1] - ca[1]
            d = math.sqrt(dx * dx + dy * dy)
            if d == 0.0:
                nx, ny = 1.0, 0.0
                overlap = ra + rb
            else:
                nx, ny = dx / d, dy / d
                overlap = (ra + rb) - d
            half = overlap / 2.0
            ca[0] -= half * nx
            ca[1] -= half * ny
            cb[0] += half * nx
            cb[1] += half * ny
            vn = (ca[2] - cb[2]) * nx + (ca[3] - cb[3]) * ny
            if vn > 0:
                ma = ra * ra
                mb = rb * rb
                j = (1.0 + E) * vn / (1.0 / ma + 1.0 / mb)
                ca[2] -= (j / ma) * nx
                ca[3] -= (j / ma) * ny
                cb[2] += (j / mb) * nx
                cb[3] += (j / mb) * ny
        if tick in checkpoint_set:
            snap = {}
            for cid in ids:
                c = circ[cid]
                snap[cid] = (c[0], c[1], c[2], c[3])
            outputs.append(
                {
                    "tick": tick,
                    "checks": checks,
                    "collisions": set(colliding),
                    "circles": snap,
                }
            )
    outputs.sort(key=lambda b: b["tick"])
    return outputs, N


def _parse_output(text):
    toks = text.split()
    i = 0
    blocks = []

    def grab(expected_keyword):
        nonlocal i
        assert i + 1 < len(toks), f"Truncated output near token index {i}."
        assert toks[i] == expected_keyword, (
            f"Expected keyword '{expected_keyword}' but found '{toks[i]}' at token {i}."
        )
        val = toks[i + 1]
        i += 2
        return val

    while i < len(toks):
        tick = int(grab("TICK"))
        checks = int(grab("CHECKS"))
        m = int(grab("COLLISIONS"))
        pairs = set()
        for _ in range(m):
            assert i + 1 < len(toks), "Truncated output while reading collision pairs."
            a = int(toks[i])
            b = int(toks[i + 1])
            i += 2
            assert a < b, f"Collision pair must be printed with i<j, got {a} {b}."
            pairs.add((a, b))
        n = int(grab("CIRCLES"))
        circles = {}
        for _ in range(n):
            assert i + 4 < len(toks), "Truncated output while reading circle rows."
            cid = int(toks[i])
            comps = toks[i + 1 : i + 5]
            for comp in comps:
                assert COORD_RE.match(comp), (
                    f"Circle coordinate '{comp}' is not formatted with exactly 5 decimals."
                )
            circles[cid] = tuple(float(x) for x in comps)
            i += 5
        blocks.append(
            {"tick": tick, "checks": checks, "collisions": pairs, "circles": circles}
        )
    return blocks


def _assert_matches(actual_text, input_text, check_pruning=False):
    expected, n = _reference(input_text)
    actual = _parse_output(actual_text)
    assert len(actual) == len(expected), (
        f"Expected {len(expected)} checkpoint block(s), got {len(actual)}."
    )
    for exp, act in zip(expected, actual):
        t = exp["tick"]
        assert act["tick"] == t, f"Expected TICK {t}, got TICK {act['tick']}."
        assert act["checks"] == exp["checks"], (
            f"At tick {t}: expected CHECKS {exp['checks']}, got {act['checks']}. "
            "The reported narrow-phase check count must equal the number of distinct "
            "spatial-hash candidate pairs."
        )
        if check_pruning:
            all_pairs = n * (n - 1) // 2
            assert exp["checks"] < all_pairs, (
                f"Test fixture invalid: expected pruning (checks < {all_pairs})."
            )
        assert act["collisions"] == exp["collisions"], (
            f"At tick {t}: colliding pair set mismatch. "
            f"expected {sorted(exp['collisions'])}, got {sorted(act['collisions'])}."
        )
        assert set(act["circles"].keys()) == set(exp["circles"].keys()), (
            f"At tick {t}: circle id set mismatch."
        )
        for cid, ev in exp["circles"].items():
            av = act["circles"][cid]
            labels = ("x", "y", "vx", "vy")
            for k in range(4):
                assert abs(av[k] - ev[k]) <= FLOAT_TOL, (
                    f"At tick {t}, circle {cid}: {labels[k]} expected {ev[k]:.5f}, "
                    f"got {av[k]:.5f} (tolerance {FLOAT_TOL})."
                )


def _run_sim(input_text, tmp_path, tag):
    inp = os.path.join(str(tmp_path), f"{tag}_in.txt")
    out = os.path.join(str(tmp_path), f"{tag}_out.txt")
    with open(inp, "w") as f:
        f.write(input_text)
    if os.path.exists(out):
        os.remove(out)
    result = subprocess.run(
        [
            "./gradlew",
            "--no-daemon",
            "--offline",
            "--console=plain",
            "-q",
            "run",
            f"--args={inp} {out}",
        ],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=GRADLE_TIMEOUT,
    )
    assert result.returncode == 0, (
        f"Gradle run failed (exit {result.returncode}).\nSTDOUT:\n{result.stdout}\n"
        f"STDERR:\n{result.stderr}"
    )
    assert os.path.isfile(out), f"Output file {out} was not created."
    with open(out) as f:
        return f.read()


# --------------------------------------------------------------------------- #
# Input fixtures (axis-aligned, equal-radius, dyadic values -> exact).         #
# --------------------------------------------------------------------------- #
HEADON = (
    "100 100\n"
    "10\n"
    "1\n"
    "5\n"
    "1\n"
    "1\n"
    "2\n"
    "2\n"
    "0 10 50 3 0 1\n"
    "1 23 50 -3 0 1\n"
)

SPREAD = (
    "100 100\n"
    "10\n"
    "1\n"
    "1\n"
    "1\n"
    "1\n"
    "1\n"
    "4\n"
    "0 5 5 0 0 1\n"
    "1 95 5 0 0 1\n"
    "2 5 95 0 0 1\n"
    "3 95 95 0 0 1\n"
)


def _grid_input():
    lines = []
    lines.append("200 200")
    lines.append("20")
    lines.append("1")
    lines.append("5")
    lines.append("1")
    lines.append("3")
    lines.append("1 2 4")
    circles = []
    for p in range(6):
        y = 20 * p + 10
        circles.append(f"{2 * p} 44 {y} 1 0 2")
        circles.append(f"{2 * p + 1} 50 {y} -1 0 2")
    circles.append("100 150 150 0 0 2")
    circles.append("101 10 190 0 0 2")
    lines.append(str(len(circles)))
    lines.extend(circles)
    return "\n".join(lines) + "\n"


GRID = _grid_input()


@pytest.fixture(scope="session")
def built_project():
    result = subprocess.run(
        ["./gradlew", "--no-daemon", "--offline", "--console=plain", "-q", "build"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=GRADLE_TIMEOUT,
    )
    print("=== gradle build STDOUT ===")
    print(result.stdout)
    print("=== gradle build STDERR ===")
    print(result.stderr)
    assert result.returncode == 0, (
        f"Project failed to build offline (exit {result.returncode}). "
        "Dependencies must resolve from the local cache."
    )
    return True


def test_headon_elastic_collision(built_project, tmp_path):
    out = _run_sim(HEADON, tmp_path, "headon")
    _assert_matches(out, HEADON)
    blocks = _parse_output(out)
    assert len(blocks) == 1 and blocks[0]["tick"] == 2, "Expected a single TICK 2 block."
    b = blocks[0]
    assert b["checks"] == 1, f"Expected CHECKS 1 at tick 2, got {b['checks']}."
    assert b["collisions"] == {(0, 1)}, f"Expected colliding pair (0,1), got {b['collisions']}."
    x0, y0, vx0, vy0 = b["circles"][0]
    x1, y1, vx1, vy1 = b["circles"][1]
    assert abs(x0 - 15.5) <= FLOAT_TOL and abs(y0 - 50.0) <= FLOAT_TOL
    assert abs(vx0 - (-3.0)) <= FLOAT_TOL and abs(vy0 - 0.0) <= FLOAT_TOL
    assert abs(x1 - 17.5) <= FLOAT_TOL and abs(y1 - 50.0) <= FLOAT_TOL
    assert abs(vx1 - 3.0) <= FLOAT_TOL and abs(vy1 - 0.0) <= FLOAT_TOL


def test_broadphase_pruning_no_collisions(built_project, tmp_path):
    out = _run_sim(SPREAD, tmp_path, "spread")
    _assert_matches(out, SPREAD)
    blocks = _parse_output(out)
    assert len(blocks) == 1 and blocks[0]["tick"] == 1
    assert blocks[0]["checks"] == 0, (
        f"Expected CHECKS 0 (no two circles share a cell), got {blocks[0]['checks']}. "
        "A correct broad phase must not perform any narrow-phase check here."
    )
    assert blocks[0]["collisions"] == set(), "Expected no collisions."


def test_grid_broadphase_and_collisions(built_project, tmp_path):
    out = _run_sim(GRID, tmp_path, "grid")
    _assert_matches(out, GRID, check_pruning=True)


def test_deterministic_output(built_project, tmp_path):
    out1 = _run_sim(GRID, tmp_path, "det1")
    out2 = _run_sim(GRID, tmp_path, "det2")
    norm1 = "\n".join(line.rstrip() for line in out1.strip().splitlines())
    norm2 = "\n".join(line.rstrip() for line in out2.strip().splitlines())
    assert norm1 == norm2, "Two runs on identical input produced different output; simulation is not deterministic."
