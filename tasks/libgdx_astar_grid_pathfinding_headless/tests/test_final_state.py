import os
import re
import glob
import shutil
import tempfile
import subprocess

import pytest

PROJECT_DIR = "/home/user/gdx-astar"

# ---------------------------------------------------------------------------
# Fixture map files (verbatim from the verification plan) and their expected,
# grammar-filtered stdout.
# ---------------------------------------------------------------------------
MAP1 = """6 7
0 0
5 6
1119999
9919999
9911999
9991199
9999119
9999911
"""

MAP2 = """5 5
0 0
4 4
11111
11111
11###
11#44
11#41
"""

MAP3 = """5 5
0 0
4 4
12999
91199
9#119
99#11
999#1
"""

MAP4 = """4 6
1 0
2 5
199991
122991
199211
991119
"""

EXPECTED1 = [
    "LENGTH 7",
    "COST 8.0711",
    "PATH",
    "0,0",
    "0,1",
    "1,2",
    "2,3",
    "3,4",
    "4,5",
    "5,6",
]

EXPECTED2 = ["NO PATH"]

EXPECTED3 = [
    "LENGTH 6",
    "COST 6.2426",
    "PATH",
    "0,0",
    "1,1",
    "1,2",
    "2,3",
    "3,4",
    "4,4",
]

EXPECTED4 = [
    "LENGTH 6",
    "COST 8.8284",
    "PATH",
    "1,0",
    "1,1",
    "1,2",
    "2,3",
    "2,4",
    "2,5",
]

# Grammar of the program's meaningful output lines.
OUTPUT_LINE_RE = re.compile(r"^(LENGTH \d+|COST \d+\.\d{4}|PATH|NO PATH|\d+,\d+)$")


@pytest.fixture(scope="session")
def maps_dir():
    d = tempfile.mkdtemp(prefix="astar_maps_")
    files = {}
    for name, content in (
        ("map1.txt", MAP1),
        ("map2.txt", MAP2),
        ("map3.txt", MAP3),
        ("map4.txt", MAP4),
    ):
        p = os.path.join(d, name)
        with open(p, "w") as f:
            f.write(content)
        files[name] = p
    yield files
    shutil.rmtree(d, ignore_errors=True)


def _gradlew_cmd():
    """Return the base argv used to invoke the Gradle wrapper in PROJECT_DIR."""
    wrapper = os.path.join(PROJECT_DIR, "gradlew")
    assert os.path.isfile(wrapper), (
        f"Gradle wrapper not found at {wrapper}; the project must be runnable via "
        f"`./gradlew` from {PROJECT_DIR}."
    )
    # Invoke through `bash` so a missing execute bit does not break the run.
    return ["bash", "gradlew", "-q", "--console=plain", "--offline"]


def _run_solver(map_path):
    """Run `./gradlew -q run --args=<map_path>` and return grammar-filtered stdout lines."""
    cmd = _gradlew_cmd() + ["run", f"--args={map_path}"]
    result = subprocess.run(
        cmd,
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=600,
    )
    assert result.returncode == 0, (
        f"Running the solver failed (exit {result.returncode}).\n"
        f"CMD: {' '.join(cmd)}\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
    )
    lines = [ln.strip() for ln in result.stdout.splitlines()]
    filtered = [ln for ln in lines if OUTPUT_LINE_RE.match(ln)]
    return filtered, result.stdout, result.stderr


# ---------------------------------------------------------------------------
# Static implementation constraints (non-runtime; no observable runtime proxy).
# ---------------------------------------------------------------------------
def _java_sources():
    files = glob.glob(os.path.join(PROJECT_DIR, "**", "*.java"), recursive=True)
    # Ignore anything under a build output directory.
    return [f for f in files if f"{os.sep}build{os.sep}" not in f]


def _read_all(paths):
    out = {}
    for p in paths:
        try:
            with open(p, "r", errors="replace") as f:
                out[p] = f.read()
        except OSError:
            pass
    return out


def test_uses_binaryheap_frontier():
    sources = _read_all(_java_sources())
    assert sources, f"No Java source files found under {PROJECT_DIR}."
    hits = [p for p, txt in sources.items() if "BinaryHeap" in txt]
    assert hits, (
        "No Java source references com.badlogic.gdx.utils.BinaryHeap; the A* frontier must "
        "be built on top of libGDX's BinaryHeap with a custom BinaryHeap.Node subclass."
    )


def test_no_forbidden_frontier_structures():
    sources = _read_all(_java_sources())
    forbidden = ["PriorityQueue", "TreeSet", "TreeMap"]
    offenders = {}
    for p, txt in sources.items():
        for tok in forbidden:
            if tok in txt:
                offenders.setdefault(tok, []).append(p)
    assert not offenders, (
        "Found forbidden JDK priority-queue / self-balancing-tree usage in the sources "
        f"(the frontier must be libGDX BinaryHeap): {offenders}"
    )


def test_uses_headless_backend_and_no_gl():
    sources = _read_all(_java_sources())
    all_text = "\n".join(sources.values())
    assert "HeadlessApplication" in all_text, (
        "Sources do not construct a com.badlogic.gdx.backends.headless.HeadlessApplication; "
        "the tool must run under the libGDX headless backend."
    )
    forbidden_gl = ["SpriteBatch", "BitmapFont", "Gdx.gl"]
    present = [tok for tok in forbidden_gl if tok in all_text]
    assert not present, (
        f"Sources reference OpenGL/graphics APIs that are illegal under headless: {present}"
    )


def test_build_declares_headless_dependency():
    build_files = []
    for pat in ("*.gradle", "*.gradle.kts"):
        build_files.extend(glob.glob(os.path.join(PROJECT_DIR, "**", pat), recursive=True))
    build_files = [f for f in build_files if f"{os.sep}build{os.sep}" not in f]
    contents = _read_all(build_files)
    assert contents, f"No Gradle build files found under {PROJECT_DIR}."
    all_text = "\n".join(contents.values())
    assert "gdx-backend-headless" in all_text, (
        "No Gradle build file declares com.badlogicgames.gdx:gdx-backend-headless; the "
        "headless backend dependency is required."
    )


# ---------------------------------------------------------------------------
# Runtime behavior on the fixture maps.
# ---------------------------------------------------------------------------
def test_map1_diagonal_weighted_route(maps_dir):
    filtered, out, err = _run_solver(maps_dir["map1.txt"])
    assert filtered == EXPECTED1, (
        f"map1 output mismatch.\nExpected: {EXPECTED1}\nGot: {filtered}\n"
        f"Raw stdout:\n{out}\nstderr:\n{err}"
    )


def test_map2_unreachable_goal(maps_dir):
    filtered, out, err = _run_solver(maps_dir["map2.txt"])
    assert filtered == EXPECTED2, (
        f"map2 (unreachable) output mismatch. Expected exactly ['NO PATH'].\n"
        f"Got: {filtered}\nRaw stdout:\n{out}\nstderr:\n{err}"
    )


def test_map3_no_corner_cutting(maps_dir):
    filtered, out, err = _run_solver(maps_dir["map3.txt"])
    assert filtered == EXPECTED3, (
        f"map3 output mismatch. A COST of 5.6569 indicates diagonal corner-cutting was "
        f"wrongly allowed.\nExpected: {EXPECTED3}\nGot: {filtered}\n"
        f"Raw stdout:\n{out}\nstderr:\n{err}"
    )


def test_map4_weighted_noncorner_start(maps_dir):
    filtered, out, err = _run_solver(maps_dir["map4.txt"])
    assert filtered == EXPECTED4, (
        f"map4 output mismatch.\nExpected: {EXPECTED4}\nGot: {filtered}\n"
        f"Raw stdout:\n{out}\nstderr:\n{err}"
    )
