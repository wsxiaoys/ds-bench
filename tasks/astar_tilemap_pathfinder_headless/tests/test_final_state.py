import math
import os
import subprocess
import tempfile

import pytest

PROJECT_DIR = "/home/user/astar"
RUN_SCRIPT = os.path.join(PROJECT_DIR, "run.sh")
SQRT2 = math.sqrt(2.0)
RUN_TIMEOUT = 900  # generous: an offline gradle build may run on the first invocation

# ---------------------------------------------------------------------------
# Reference model of the required movement / cost / corner-cutting rules.
# Used to compute ground-truth optimal costs and reachability so that the
# checker accepts ANY least-cost valid path produced by the solution.
# ---------------------------------------------------------------------------

DIRS = [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)]


def parse_scenario(text):
    toks = text.split()
    i = 0
    rows = int(toks[i]); i += 1
    cols = int(toks[i]); i += 1
    grid = []
    for _r in range(rows):
        row = []
        for _c in range(cols):
            row.append(int(toks[i])); i += 1
        grid.append(row)
    q = int(toks[i]); i += 1
    queries = []
    for _ in range(q):
        sr = int(toks[i]); sc = int(toks[i + 1]); gr = int(toks[i + 2]); gc = int(toks[i + 3]); i += 4
        queries.append((sr, sc, gr, gc))
    return rows, cols, grid, queries


def move_cost(grid, rows, cols, r, c, nr, nc):
    """Return the legal step cost from (r,c) to (nr,nc), or None if the move is illegal."""
    dr, dc = nr - r, nc - c
    if max(abs(dr), abs(dc)) != 1 or (dr == 0 and dc == 0):
        return None
    if not (0 <= nr < rows and 0 <= nc < cols):
        return None
    w = grid[nr][nc]
    if w == 0:
        return None
    if dr != 0 and dc != 0:
        # corner-cutting forbidden: both shared orthogonal cells must be passable
        if grid[r + dr][c] == 0 or grid[r][c + dc] == 0:
            return None
        return w * SQRT2
    return float(w)


def neighbors(grid, rows, cols, r, c):
    out = []
    for dr, dc in DIRS:
        nr, nc = r + dr, c + dc
        if not (0 <= nr < rows and 0 <= nc < cols):
            continue
        cost = move_cost(grid, rows, cols, r, c, nr, nc)
        if cost is not None:
            out.append((nr, nc, cost))
    return out


def optimal_cost(grid, rows, cols, s, g):
    """Return the minimum path cost from s to g, or None if unreachable / blocked."""
    import heapq
    sr, sc = s
    gr, gc = g
    if grid[sr][sc] == 0 or grid[gr][gc] == 0:
        return None
    if s == g:
        return 0.0
    dist = {(sr, sc): 0.0}
    pq = [(0.0, sr, sc)]
    done = set()
    while pq:
        d, r, c = heapq.heappop(pq)
        if (r, c) in done:
            continue
        done.add((r, c))
        if (r, c) == (gr, gc):
            return d
        for nr, nc, cost in neighbors(grid, rows, cols, r, c):
            nd = d + cost
            if (nr, nc) not in dist or nd < dist[(nr, nc)] - 1e-12:
                dist[(nr, nc)] = nd
                heapq.heappush(pq, (nd, nr, nc))
    return dist.get((gr, gc))


# ---------------------------------------------------------------------------
# Helpers to run the solution and validate its output lines.
# ---------------------------------------------------------------------------


def _run(scenario_text):
    """Write the scenario to a temp file, run run.sh, and return the list of output lines."""
    assert os.path.isfile(RUN_SCRIPT), f"Run script not found at {RUN_SCRIPT}."
    d = tempfile.mkdtemp(prefix="astar_")
    in_path = os.path.join(d, "scenario.txt")
    out_path = os.path.join(d, "out.txt")
    with open(in_path, "w") as f:
        f.write(scenario_text)
    if os.path.exists(out_path):
        os.remove(out_path)
    proc = subprocess.run(
        ["bash", RUN_SCRIPT, in_path, out_path],
        capture_output=True, text=True, cwd=PROJECT_DIR, timeout=RUN_TIMEOUT,
    )
    assert proc.returncode == 0, (
        f"run.sh exited with code {proc.returncode}.\nSTDOUT:\n{proc.stdout}\nSTDERR:\n{proc.stderr}"
    )
    assert os.path.isfile(out_path), (
        f"run.sh did not create the output file {out_path}.\nSTDOUT:\n{proc.stdout}\nSTDERR:\n{proc.stderr}"
    )
    with open(out_path) as f:
        raw = f.read()
    lines = [ln.strip() for ln in raw.splitlines()]
    while lines and lines[-1] == "":
        lines.pop()
    return lines, out_path


def _validate_line(grid, rows, cols, query, line):
    sr, sc, gr, gc = query
    opt = optimal_cost(grid, rows, cols, (sr, sc), (gr, gc))
    if line == "NO_PATH":
        assert opt is None, (
            f"Query {query}: solution reported NO_PATH but a path with cost {opt} exists."
        )
        return
    assert opt is not None, (
        f"Query {query}: solution reported '{line}' but there is no valid path (expected NO_PATH)."
    )
    toks = line.split()
    assert len(toks) >= 3, f"Query {query}: malformed result line '{line}'."
    # length token: exactly three digits after the decimal point
    length_tok = toks[0]
    assert "." in length_tok and len(length_tok.split(".")[1]) == 3, (
        f"Query {query}: length '{length_tok}' is not formatted with exactly 3 decimals."
    )
    reported_len = float(length_tok)
    count = int(toks[1])
    cells = []
    for t in toks[2:]:
        parts = t.split(",")
        assert len(parts) == 2, f"Query {query}: malformed cell token '{t}'."
        cells.append((int(parts[0]), int(parts[1])))
    assert count == len(cells), (
        f"Query {query}: node count {count} does not match number of listed cells {len(cells)}."
    )
    assert cells[0] == (sr, sc), f"Query {query}: path does not start at the start cell; got {cells[0]}."
    assert cells[-1] == (gr, gc), f"Query {query}: path does not end at the goal cell; got {cells[-1]}."
    # walk the path, summing legal step costs
    total = 0.0
    for a, b in zip(cells, cells[1:]):
        cost = move_cost(grid, rows, cols, a[0], a[1], b[0], b[1])
        assert cost is not None, (
            f"Query {query}: illegal move {a}->{b} (out of bounds, into a wall, or corner-cutting)."
        )
        total += cost
    # start == goal special case
    if (sr, sc) == (gr, gc):
        assert len(cells) == 1 and abs(reported_len) < 1e-9, (
            f"Query {query}: start==goal should be '0.000 1 {sr},{sc}', got '{line}'."
        )
    # reported length must match the walked cost (allowing 3-decimal rounding)
    assert abs(total - reported_len) <= 1.5e-3, (
        f"Query {query}: reported length {reported_len} does not match the path's true cost {total:.6f}."
    )
    # the path must be least-cost
    assert abs(total - opt) <= 1e-6, (
        f"Query {query}: path cost {total:.6f} is not optimal (optimal is {opt:.6f})."
    )


def _run_and_validate(scenario_text):
    rows, cols, grid, queries = parse_scenario(scenario_text)
    lines, out_path = _run(scenario_text)
    assert len(lines) == len(queries), (
        f"Expected {len(queries)} result lines, got {len(lines)} in {out_path}: {lines}"
    )
    for query, line in zip(queries, lines):
        _validate_line(grid, rows, cols, query, line)
    return lines


# ---------------------------------------------------------------------------
# Scenario fixtures (from the verification plan).
# ---------------------------------------------------------------------------

SCENARIO_BASIC = """3 3
1 1 1
1 1 1
1 1 1
3
0 0 2 2
0 0 0 0
2 0 0 2
"""

SCENARIO_WALLS = """3 3
1 0 1
0 1 1
1 1 1
2
0 0 2 2
1 1 2 2
"""

SCENARIO_WEIGHTED = """4 5
1 1 1 1 1
1 9 9 9 1
1 9 1 1 1
1 1 1 2 1
2
0 0 3 4
0 0 2 2
"""

SCENARIO_CORNER = """3 3
1 1 3
1 0 1
2 1 1
1
0 0 2 2
"""

SCENARIO_HELDOUT = """9 12
1 1 1 1 1 1 1 1 1 1 1 1
1 0 0 0 1 1 1 1 1 1 1 1
1 0 1 0 1 1 0 1 1 1 1 1
1 0 0 0 1 1 0 1 1 1 1 1
1 1 1 1 1 1 0 1 1 1 1 1
1 5 5 5 5 1 0 1 1 1 1 1
1 1 1 1 1 1 0 0 0 0 1 1
1 1 1 1 1 1 1 1 1 0 1 1
1 1 1 1 1 1 1 1 1 1 1 1
4
0 0 8 11
0 0 2 2
8 0 0 11
3 0 8 11
"""


@pytest.fixture(scope="session", autouse=True)
def _warmup():
    """Trigger any offline build once so per-test runs are fast."""
    if os.path.isfile(RUN_SCRIPT):
        try:
            _run(SCENARIO_BASIC)
        except Exception:
            # Let the real test cases surface a precise failure.
            pass
    yield


# ---------------------------------------------------------------------------
# Static checks: headless backend, libGDX BinaryHeap frontier, no OpenGL.
# ---------------------------------------------------------------------------


def _java_sources():
    sources = {}
    for dirpath, dirnames, filenames in os.walk(PROJECT_DIR):
        # skip build output directories
        dirnames[:] = [d for d in dirnames if d not in (".gradle", "build", ".git")]
        for fn in filenames:
            if fn.endswith(".java"):
                p = os.path.join(dirpath, fn)
                try:
                    with open(p, "r", errors="ignore") as f:
                        sources[p] = f.read()
                except OSError:
                    pass
    return sources


def test_project_and_run_script_exist():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."
    assert os.path.isfile(RUN_SCRIPT), f"Run script {RUN_SCRIPT} does not exist."


def test_uses_headless_backend():
    srcs = _java_sources()
    assert srcs, f"No Java source files found under {PROJECT_DIR}."
    assert any("HeadlessApplication" in c for c in srcs.values()), (
        "No source references 'HeadlessApplication'; the pathfinder must run on the libGDX headless backend."
    )


def test_uses_libgdx_binary_heap():
    srcs = _java_sources()
    assert any("BinaryHeap" in c for c in srcs.values()), (
        "No source references 'BinaryHeap'; the A* frontier must use com.badlogic.gdx.utils.BinaryHeap."
    )


def test_no_opengl_usage():
    srcs = _java_sources()
    for path, content in srcs.items():
        assert "Gdx.gl" not in content, f"Source {path} references 'Gdx.gl'; no OpenGL usage is allowed."
        assert "SpriteBatch" not in content, f"Source {path} references 'SpriteBatch'; no rendering is allowed."


# ---------------------------------------------------------------------------
# Functional checks.
# ---------------------------------------------------------------------------


def test_scenario_basic():
    _run_and_validate(SCENARIO_BASIC)


def test_scenario_walls_corner_isolation():
    lines = _run_and_validate(SCENARIO_WALLS)
    assert lines[0] == "NO_PATH", (
        f"Top-left cell is sealed by the corner-cutting rule; expected NO_PATH, got '{lines[0]}'."
    )


def test_scenario_weighted():
    _run_and_validate(SCENARIO_WEIGHTED)


def test_scenario_corner_detour():
    _run_and_validate(SCENARIO_CORNER)


def test_determinism_repeated_runs_identical():
    lines1, _ = _run(SCENARIO_BASIC)
    lines2, _ = _run(SCENARIO_BASIC)
    assert lines1 == lines2, (
        f"Output is not deterministic across runs:\nrun1={lines1}\nrun2={lines2}"
    )


def test_scenario_heldout_large_map():
    lines = _run_and_validate(SCENARIO_HELDOUT)
    assert lines[1] == "NO_PATH", (
        f"The sealed pocket cell (2,2) must be unreachable; expected NO_PATH, got '{lines[1]}'."
    )
