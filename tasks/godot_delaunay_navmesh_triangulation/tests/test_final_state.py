import os
import re
import shutil
import subprocess
import tempfile

import pytest

PROJECT_DIR = "/home/user/project"
NAVMESH_SCRIPT = os.path.join(PROJECT_DIR, "navmesh.gd")

# Standalone verifier (extends SceneTree) executed via `godot --headless --script`.
# It loads the solution at res://navmesh.gd, builds the navmesh from a fixed
# concave-L-shape-with-two-holes fixture, and prints one `CHECK <name>: PASS/FAIL`
# line per verification step. All coordinate/area facts mirror the truth plan:
#   boundary area 160000, hole A 10000, hole B 8300 -> walkable 141700.
# Hole B is passed with reversed winding to exercise winding independence.
VERIFIER_GD = r'''extends SceneTree

const EPS := 0.001
var failures := 0

func report(cname, ok, msg):
    if ok:
        print("CHECK ", cname, ": PASS")
    else:
        print("CHECK ", cname, ": FAIL ", msg)
        failures += 1

func tri_area(t) -> float:
    var a = t[0]
    var b = t[1]
    var c = t[2]
    return absf((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) * 0.5

func tri_centroid(t) -> Vector2:
    return (t[0] + t[1] + t[2]) / 3.0

func shared_vertices(t1, t2) -> int:
    var count := 0
    for p in t1:
        for q in t2:
            if p.distance_to(q) < EPS:
                count += 1
                break
    return count

func norm_list(l) -> Array:
    var out := []
    for x in l:
        out.append(int(x))
    out.sort()
    return out

func finish():
    if failures == 0:
        print("ALL CHECKS PASSED")
        quit(0)
    else:
        print("CHECKS FAILED: ", failures)
        quit(1)

func _init():
    var boundary := PackedVector2Array([Vector2(0,0), Vector2(600,0), Vector2(600,200), Vector2(200,200), Vector2(200,400), Vector2(0,400)])
    var hole_a := PackedVector2Array([Vector2(80,80), Vector2(180,80), Vector2(180,180), Vector2(80,180)])
    # Reversed winding relative to hole A to test winding independence.
    var hole_b := PackedVector2Array([Vector2(420,160), Vector2(500,60), Vector2(350,40)])
    var holes := [hole_a, hole_b]

    var script = load("res://navmesh.gd")
    if script == null:
        report("load_script", false, "could not load res://navmesh.gd")
        finish()
        return
    var nav = script.new()
    if nav == null:
        report("instantiate", false, "script.new() returned null")
        finish()
        return
    var required = ["build", "get_triangles", "get_adjacency", "triangle_at_point", "find_triangle_path"]
    for m in required:
        if not nav.has_method(m):
            report("api_methods", false, "missing method: " + m)
    if failures > 0:
        finish()
        return

    nav.build(boundary, holes)

    var tris = nav.get_triangles()
    var n = tris.size()

    # Check 1: triangles exist and are well-formed.
    var ok1 = n > 0
    var msg1 = "triangle count = " + str(n)
    for i in range(n):
        var t = tris[i]
        if t.size() != 3:
            ok1 = false
            msg1 = "triangle " + str(i) + " does not have exactly 3 vertices"
            break
        if tri_area(t) <= EPS:
            ok1 = false
            msg1 = "triangle " + str(i) + " is degenerate"
            break
    report("triangles_wellformed", ok1, msg1)

    # Check 2: every triangle lies within the walkable region (centroid test).
    var ok2 = true
    var msg2 = ""
    for i in range(n):
        var c = tri_centroid(tris[i])
        if not Geometry2D.is_point_in_polygon(c, boundary):
            ok2 = false
            msg2 = "triangle " + str(i) + " centroid outside boundary"
            break
        if Geometry2D.is_point_in_polygon(c, hole_a) or Geometry2D.is_point_in_polygon(c, hole_b):
            ok2 = false
            msg2 = "triangle " + str(i) + " centroid inside a hole"
            break
    report("triangles_within_region", ok2, msg2)

    # Check 3: exact coverage of the walkable region.
    var total = 0.0
    for i in range(n):
        total += tri_area(tris[i])
    var ok3 = absf(total - 141700.0) <= 1.0
    report("coverage_area", ok3, "total area = " + str(total) + " expected 141700")

    # Check 4: adjacency matches the shared-edge definition.
    var adj = nav.get_adjacency()
    var ok4 = true
    var msg4 = ""
    if adj.size() != n:
        ok4 = false
        msg4 = "adjacency length " + str(adj.size()) + " != triangle count " + str(n)
    else:
        for i in range(n):
            var expected := []
            for j in range(n):
                if i != j and shared_vertices(tris[i], tris[j]) >= 2:
                    expected.append(j)
            expected.sort()
            var got = norm_list(adj[i])
            if got != expected:
                ok4 = false
                msg4 = "triangle " + str(i) + " adjacency mismatch: got " + str(got) + " expected " + str(expected)
                break
    report("adjacency_shared_edge", ok4, msg4)

    # Check 5: point location for walkable points.
    var wpts = [Vector2(300,100), Vector2(50,300), Vector2(550,100)]
    var ok5 = true
    var msg5 = ""
    for p in wpts:
        var t = nav.triangle_at_point(p)
        if t < 0 or t >= n:
            ok5 = false
            msg5 = "point " + str(p) + " -> " + str(t) + " (expected a valid triangle)"
            break
        if not Geometry2D.point_is_inside_triangle(p, tris[t][0], tris[t][1], tris[t][2]):
            ok5 = false
            msg5 = "triangle " + str(t) + " does not actually contain point " + str(p)
            break
    report("point_location_walkable", ok5, msg5)

    # Check 6: points inside holes are rejected.
    var hpts = [Vector2(130,130), Vector2(423,90)]
    var ok6 = true
    var msg6 = ""
    for p in hpts:
        var t = nav.triangle_at_point(p)
        if t != -1:
            ok6 = false
            msg6 = "hole point " + str(p) + " -> " + str(t) + " (expected -1)"
            break
    report("point_location_holes", ok6, msg6)

    # Check 7: points outside the boundary are rejected.
    var epts = [Vector2(500,300), Vector2(-50,50)]
    var ok7 = true
    var msg7 = ""
    for p in epts:
        var t = nav.triangle_at_point(p)
        if t != -1:
            ok7 = false
            msg7 = "exterior point " + str(p) + " -> " + str(t) + " (expected -1)"
            break
    report("point_location_exterior", ok7, msg7)

    # Check 8: valid triangle path between two walkable points.
    var start = Vector2(50,300)
    var goal = Vector2(550,100)
    var path = nav.find_triangle_path(start, goal)
    var ok8 = true
    var msg8 = ""
    if path.size() == 0:
        ok8 = false
        msg8 = "empty path between two walkable points"
    else:
        var ts = nav.triangle_at_point(start)
        var tg = nav.triangle_at_point(goal)
        if path[0] != ts:
            ok8 = false
            msg8 = "path[0]=" + str(path[0]) + " != triangle_at_point(start)=" + str(ts)
        elif path[path.size()-1] != tg:
            ok8 = false
            msg8 = "path[-1]=" + str(path[path.size()-1]) + " != triangle_at_point(goal)=" + str(tg)
        else:
            for k in range(path.size()-1):
                var a = path[k]
                var b = path[k+1]
                if a < 0 or a >= n or b < 0 or b >= n:
                    ok8 = false
                    msg8 = "path contains an out-of-range index"
                    break
                if shared_vertices(tris[a], tris[b]) < 2:
                    ok8 = false
                    msg8 = "path steps " + str(a) + " -> " + str(b) + " are not adjacent triangles"
                    break
    report("path_valid", ok8, msg8)

    # Check 9: destination inside a hole yields an empty path.
    var path2 = nav.find_triangle_path(Vector2(50,300), Vector2(130,130))
    report("path_unreachable", path2.size() == 0, "expected empty path, got size " + str(path2.size()))

    # Check 10: identical endpoints yield a single-triangle path.
    var dp = Vector2(300,100)
    var path3 = nav.find_triangle_path(dp, dp)
    var td = nav.triangle_at_point(dp)
    var ok10 = path3.size() == 1 and path3[0] == td
    report("path_degenerate", ok10, "expected [" + str(td) + "], got " + str(path3))

    finish()
'''

CHECK_RE = re.compile(r"^CHECK (\w+): (PASS|FAIL)(?: (.*))?$")


def _run_verifier():
    godot = shutil.which("godot")
    assert godot is not None, "godot binary not found in PATH."
    assert os.path.isfile(NAVMESH_SCRIPT), (
        f"Solution script not found at {NAVMESH_SCRIPT}."
    )

    fd, script_path = tempfile.mkstemp(suffix=".gd", prefix="navmesh_verifier_")
    try:
        with os.fdopen(fd, "w") as f:
            f.write(VERIFIER_GD)
        proc = subprocess.run(
            [godot, "--headless", "--path", PROJECT_DIR, "--script", script_path],
            capture_output=True,
            text=True,
            timeout=240,
        )
    finally:
        if os.path.exists(script_path):
            os.remove(script_path)

    stdout = proc.stdout or ""
    stderr = proc.stderr or ""
    checks = {}
    for line in stdout.splitlines():
        m = CHECK_RE.match(line.strip())
        if m:
            checks[m.group(1)] = (m.group(2), (m.group(3) or "").strip())
    return {
        "returncode": proc.returncode,
        "stdout": stdout,
        "stderr": stderr,
        "checks": checks,
    }


@pytest.fixture(scope="session")
def verifier_result():
    result = _run_verifier()
    print("=============== Godot verifier stdout ===============")
    print(result["stdout"])
    print("=============== Godot verifier stderr ===============")
    print(result["stderr"])
    print("=====================================================")
    return result


def _assert_check(result, name):
    checks = result["checks"]
    assert name in checks, (
        f"Verifier did not report check '{name}'. "
        f"Reported checks: {sorted(checks.keys())}. "
        f"Godot stdout:\n{result['stdout']}\nstderr:\n{result['stderr']}"
    )
    status, msg = checks[name]
    assert status == "PASS", f"Check '{name}' failed: {msg}"


def test_navmesh_script_exists():
    assert os.path.isfile(NAVMESH_SCRIPT), (
        f"Expected solution script at {NAVMESH_SCRIPT}."
    )


def test_triangles_wellformed(verifier_result):
    _assert_check(verifier_result, "triangles_wellformed")


def test_triangles_within_region(verifier_result):
    _assert_check(verifier_result, "triangles_within_region")


def test_coverage_area(verifier_result):
    _assert_check(verifier_result, "coverage_area")


def test_adjacency_shared_edge(verifier_result):
    _assert_check(verifier_result, "adjacency_shared_edge")


def test_point_location_walkable(verifier_result):
    _assert_check(verifier_result, "point_location_walkable")


def test_point_location_holes(verifier_result):
    _assert_check(verifier_result, "point_location_holes")


def test_point_location_exterior(verifier_result):
    _assert_check(verifier_result, "point_location_exterior")


def test_path_valid(verifier_result):
    _assert_check(verifier_result, "path_valid")


def test_path_unreachable(verifier_result):
    _assert_check(verifier_result, "path_unreachable")


def test_path_degenerate(verifier_result):
    _assert_check(verifier_result, "path_degenerate")


def test_all_checks_passed(verifier_result):
    assert verifier_result["returncode"] == 0, (
        "Godot verifier exited non-zero. "
        f"stdout:\n{verifier_result['stdout']}\nstderr:\n{verifier_result['stderr']}"
    )
    assert "ALL CHECKS PASSED" in verifier_result["stdout"], (
        "Verifier did not report 'ALL CHECKS PASSED'. "
        f"stdout:\n{verifier_result['stdout']}"
    )
