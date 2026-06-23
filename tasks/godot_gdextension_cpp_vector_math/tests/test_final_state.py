import configparser
import os
import subprocess


PROJECT_DIR = "/home/user/myproject"
GDEXTENSION_FILE = os.path.join(PROJECT_DIR, "bin", "fast_vector_math.gdextension")


def _read_gdextension_libraries(path: str) -> dict:
    parser = configparser.ConfigParser()
    # .gdextension is INI-like; keys may contain dots. Preserve case.
    parser.optionxform = str  # type: ignore[assignment]
    with open(path, "r", encoding="utf-8") as f:
        parser.read_file(f)
    assert parser.has_section("libraries"), (
        f"{path} is missing required [libraries] section."
    )
    return dict(parser.items("libraries"))


def _resolve_res_path(res_path: str) -> str:
    val = res_path.strip().strip('"').strip("'")
    if val.startswith("res://"):
        val = val[len("res://"):]
    return os.path.join(PROJECT_DIR, val)


def test_gdextension_config_present():
    assert os.path.isfile(GDEXTENSION_FILE), (
        f"Expected GDExtension config at {GDEXTENSION_FILE}."
    )


def test_built_shared_library_exists_for_linux_x86_64():
    libs = _read_gdextension_libraries(GDEXTENSION_FILE)
    # Find any key beginning with linux. and ending with .x86_64
    matching = [
        (k, v) for k, v in libs.items()
        if k.startswith("linux.") and k.endswith(".x86_64")
    ]
    assert matching, (
        f"No 'linux.*.x86_64' entry found in [libraries] of {GDEXTENSION_FILE}. "
        f"Available keys: {list(libs.keys())}"
    )
    for key, res_path in matching:
        abs_path = _resolve_res_path(res_path)
        assert os.path.isfile(abs_path), (
            f"Library referenced by '{key}={res_path}' does not exist on disk at {abs_path}."
        )


def test_test_runner_script_exists():
    runner = os.path.join(PROJECT_DIR, "test_runner.gd")
    assert os.path.isfile(runner), (
        f"test_runner.gd is missing at {runner}."
    )


def test_godot_headless_runs_fastvectormath_checks():
    """Run the test_runner.gd inside Godot --headless and assert all checks pass.

    The test_runner.gd is responsible for asserting:
      - ClassDB.class_exists("FastVectorMath")
      - dot_product(Vector3(1,2,3), Vector3(4,5,6)) == 32.0 (tol 1e-4)
      - cross_product(Vector3(1,0,0), Vector3(0,1,0)) == Vector3(0,0,1) (tol 1e-4)
      - compute_centroid_and_bounds([(0,0,0),(2,0,0),(0,2,0),(0,0,2)])
            -> centroid == Vector3(0.5,0.5,0.5),
               min == Vector3(0,0,0),
               max == Vector3(2,2,2)  (tol 1e-4)
      - ray_sphere_intersection(Vector3(0,0,-5), Vector3(0,0,1), Vector3(0,0,0), 1.0) == 4.0 (tol 1e-3)
      - ray_sphere_intersection(Vector3(0,5,-5), Vector3(0,0,1), Vector3(0,0,0), 1.0) == -1.0
    On success it must print 'ALL TESTS PASSED' on stdout.
    """
    result = subprocess.run(
        [
            "godot",
            "--headless",
            "--path",
            PROJECT_DIR,
            "--script",
            "res://test_runner.gd",
        ],
        capture_output=True,
        text=True,
        timeout=180,
    )
    combined = (result.stdout or "") + "\n" + (result.stderr or "")
    assert "ALL TESTS PASSED" in combined, (
        "test_runner.gd did not report ALL TESTS PASSED.\n"
        f"returncode={result.returncode}\n"
        f"stdout=\n{result.stdout}\n"
        f"stderr=\n{result.stderr}"
    )
    assert "FAIL" not in combined, (
        "test_runner.gd reported a FAIL line.\n"
        f"stdout=\n{result.stdout}\n"
        f"stderr=\n{result.stderr}"
    )


def test_classdb_registration():
    """Independently confirm FastVectorMath is registered with ClassDB after the extension loads."""
    snippet = (
        'extends SceneTree\n'
        'func _init():\n'
        '\tif ClassDB.class_exists("FastVectorMath"):\n'
        '\t\tprint("CLASS_EXISTS_OK")\n'
        '\telse:\n'
        '\t\tprint("CLASS_EXISTS_FAIL")\n'
        '\tquit()\n'
    )
    script_path = os.path.join(PROJECT_DIR, "_verify_classdb.gd")
    with open(script_path, "w", encoding="utf-8") as f:
        f.write(snippet)
    try:
        result = subprocess.run(
            [
                "godot",
                "--headless",
                "--path",
                PROJECT_DIR,
                "--script",
                "res://_verify_classdb.gd",
            ],
            capture_output=True,
            text=True,
            timeout=120,
        )
        combined = (result.stdout or "") + "\n" + (result.stderr or "")
        assert "CLASS_EXISTS_OK" in combined, (
            "ClassDB does not report FastVectorMath as a registered class.\n"
            f"returncode={result.returncode}\n"
            f"stdout=\n{result.stdout}\n"
            f"stderr=\n{result.stderr}"
        )
    finally:
        try:
            os.remove(script_path)
        except OSError:
            pass


def test_method_results_via_godot():
    """Independently exercise each FastVectorMath method from a fresh GDScript and assert outputs."""
    snippet = (
        'extends SceneTree\n'
        'func _approx(a: float, b: float, tol: float) -> bool:\n'
        '\treturn abs(a - b) <= tol\n'
        'func _approx_v(a: Vector3, b: Vector3, tol: float) -> bool:\n'
        '\treturn _approx(a.x, b.x, tol) and _approx(a.y, b.y, tol) and _approx(a.z, b.z, tol)\n'
        'func _init():\n'
        '\tvar ok := true\n'
        '\tvar obj = ClassDB.instantiate("FastVectorMath")\n'
        '\tif obj == null:\n'
        '\t\tprint("INSTANTIATE_FAIL")\n'
        '\t\tquit()\n'
        '\t\treturn\n'
        '\tvar d = obj.dot_product(Vector3(1,2,3), Vector3(4,5,6))\n'
        '\tif not _approx(float(d), 32.0, 1e-4):\n'
        '\t\tprint("DOT_FAIL ", d)\n'
        '\t\tok = false\n'
        '\tvar c = obj.cross_product(Vector3(1,0,0), Vector3(0,1,0))\n'
        '\tif not _approx_v(c, Vector3(0,0,1), 1e-4):\n'
        '\t\tprint("CROSS_FAIL ", c)\n'
        '\t\tok = false\n'
        '\tvar pts := PackedVector3Array([Vector3(0,0,0), Vector3(2,0,0), Vector3(0,2,0), Vector3(0,0,2)])\n'
        '\tvar arr = obj.compute_centroid_and_bounds(pts)\n'
        '\tif arr.size() < 3:\n'
        '\t\tprint("BOUNDS_FAIL_SIZE ", arr)\n'
        '\t\tok = false\n'
        '\telse:\n'
        '\t\tif not _approx_v(arr[0], Vector3(0.5,0.5,0.5), 1e-4):\n'
        '\t\t\tprint("CENTROID_FAIL ", arr[0])\n'
        '\t\t\tok = false\n'
        '\t\tif not _approx_v(arr[1], Vector3(0,0,0), 1e-4):\n'
        '\t\t\tprint("MIN_FAIL ", arr[1])\n'
        '\t\t\tok = false\n'
        '\t\tif not _approx_v(arr[2], Vector3(2,2,2), 1e-4):\n'
        '\t\t\tprint("MAX_FAIL ", arr[2])\n'
        '\t\t\tok = false\n'
        '\tvar t = obj.ray_sphere_intersection(Vector3(0,0,-5), Vector3(0,0,1), Vector3(0,0,0), 1.0)\n'
        '\tif not _approx(float(t), 4.0, 1e-3):\n'
        '\t\tprint("RAY_HIT_FAIL ", t)\n'
        '\t\tok = false\n'
        '\tvar miss = obj.ray_sphere_intersection(Vector3(0,5,-5), Vector3(0,0,1), Vector3(0,0,0), 1.0)\n'
        '\tif not _approx(float(miss), -1.0, 1e-3):\n'
        '\t\tprint("RAY_MISS_FAIL ", miss)\n'
        '\t\tok = false\n'
        '\tif ok:\n'
        '\t\tprint("METHOD_RESULTS_OK")\n'
        '\telse:\n'
        '\t\tprint("METHOD_RESULTS_FAIL")\n'
        '\tquit()\n'
    )
    script_path = os.path.join(PROJECT_DIR, "_verify_methods.gd")
    with open(script_path, "w", encoding="utf-8") as f:
        f.write(snippet)
    try:
        result = subprocess.run(
            [
                "godot",
                "--headless",
                "--path",
                PROJECT_DIR,
                "--script",
                "res://_verify_methods.gd",
            ],
            capture_output=True,
            text=True,
            timeout=180,
        )
        combined = (result.stdout or "") + "\n" + (result.stderr or "")
        assert "METHOD_RESULTS_OK" in combined, (
            "One or more FastVectorMath method results did not match expectations.\n"
            f"returncode={result.returncode}\n"
            f"stdout=\n{result.stdout}\n"
            f"stderr=\n{result.stderr}"
        )
    finally:
        try:
            os.remove(script_path)
        except OSError:
            pass
