import json
import os
import shutil
import subprocess
import tempfile

import pytest

SOLUTION_DIR = "/home/user/gravity_sim"
SOLUTION_RESULT = os.path.join(SOLUTION_DIR, "output", "result.json")
REFERENCE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "reference_project")

EXPECTED_STEPS = [40, 80, 120, 160, 200, 240]
POS_VEL_TOL = 1e-3
DETERMINISM_TOL = 1e-6
GODOT_TIMEOUT = 240


def _run_godot_project(project_dir: str) -> subprocess.CompletedProcess:
    """Run a Godot project headless. It must set up, simulate, write its output, and quit on its own."""
    return subprocess.run(
        ["godot", "--headless", "--path", project_dir],
        capture_output=True,
        text=True,
        timeout=GODOT_TIMEOUT,
    )


def _load_result(path: str) -> dict:
    with open(path) as fh:
        return json.load(fh)


def _run_solution_fresh() -> dict:
    """Delete any stale output, run the solution project headless, and return the parsed result."""
    if os.path.exists(SOLUTION_RESULT):
        os.remove(SOLUTION_RESULT)
    proc = _run_godot_project(SOLUTION_DIR)
    assert os.path.isfile(SOLUTION_RESULT), (
        "Running `godot --headless --path /home/user/gravity_sim` did not produce "
        f"{SOLUTION_RESULT}.\n"
        f"return code: {proc.returncode}\nstdout:\n{proc.stdout}\nstderr:\n{proc.stderr}"
    )
    return _load_result(SOLUTION_RESULT)


def _run_reference() -> dict:
    """Run the hidden reference oracle project in an isolated temp copy and return its result."""
    tmp = tempfile.mkdtemp(prefix="gravity_ref_")
    dst = os.path.join(tmp, "proj")
    shutil.copytree(REFERENCE_DIR, dst)
    proc = _run_godot_project(dst)
    out = os.path.join(dst, "output", "result.json")
    assert os.path.isfile(out), (
        "The reference oracle project failed to produce output; the verifier "
        f"cannot compute ground truth.\nreturn code: {proc.returncode}\n"
        f"stdout:\n{proc.stdout}\nstderr:\n{proc.stderr}"
    )
    return _load_result(out)


@pytest.fixture(scope="session")
def solution_result() -> dict:
    return _run_solution_fresh()


@pytest.fixture(scope="session")
def reference_result() -> dict:
    return _run_reference()


def _sample_by_step(result: dict) -> dict:
    return {int(s["step"]): s for s in result.get("samples", [])}


def test_result_exists_and_parses(solution_result: dict):
    assert isinstance(solution_result, dict), "result.json must contain a JSON object at the top level."


def test_schema(solution_result: dict):
    assert solution_result.get("physics_ticks_per_second") == 60, (
        "Top-level `physics_ticks_per_second` must be 60, got "
        f"{solution_result.get('physics_ticks_per_second')!r}."
    )
    samples = solution_result.get("samples")
    assert isinstance(samples, list), "`samples` must be a JSON array."
    assert len(samples) == 6, f"`samples` must contain exactly 6 entries, got {len(samples)}."

    steps = [s.get("step") for s in samples]
    assert steps == EXPECTED_STEPS, (
        f"`samples` steps must be exactly {EXPECTED_STEPS} in ascending order, got {steps}."
    )

    for s in samples:
        pos = s.get("position")
        vel = s.get("velocity")
        assert isinstance(pos, list) and len(pos) == 3, (
            f"`position` at step {s.get('step')} must be a 3-element array, got {pos!r}."
        )
        assert isinstance(vel, list) and len(vel) == 3, (
            f"`velocity` at step {s.get('step')} must be a 3-element array, got {vel!r}."
        )
        for c in pos + vel:
            assert isinstance(c, (int, float)) and not isinstance(c, bool), (
                f"All position/velocity components must be numbers; step {s.get('step')} has {c!r}."
            )


def test_matches_reference(solution_result: dict, reference_result: dict):
    sol = _sample_by_step(solution_result)
    ref = _sample_by_step(reference_result)

    assert set(ref.keys()) == set(EXPECTED_STEPS), (
        "Reference oracle did not produce the expected sample steps; verifier setup error."
    )

    for step in EXPECTED_STEPS:
        assert step in sol, f"Missing sample for physics step {step} in the solution output."
        for field in ("position", "velocity"):
            got = sol[step][field]
            expected = ref[step][field]
            for axis, (g, e) in zip("xyz", zip(got, expected)):
                assert abs(float(g) - float(e)) <= POS_VEL_TOL, (
                    f"{field} {axis} mismatch at step {step}: got {g}, expected {e} "
                    f"(tolerance {POS_VEL_TOL}). The layered gravity fields are not "
                    f"configured exactly as specified."
                )


def test_determinism(solution_result: dict):
    # solution_result already ran the project once. Run again and require identical numbers.
    first = _sample_by_step(solution_result)
    second = _sample_by_step(_run_solution_fresh())
    for step in EXPECTED_STEPS:
        assert step in second, f"Second run is missing sample for step {step}."
        for field in ("position", "velocity"):
            a = first[step][field]
            b = second[step][field]
            for axis, (x, y) in zip("xyz", zip(a, b)):
                assert abs(float(x) - float(y)) <= DETERMINISM_TOL, (
                    f"Non-deterministic {field} {axis} at step {step}: run1={x}, run2={y}. "
                    f"The simulation must be reproducible run-to-run."
                )


def test_fields_had_effect(solution_result: dict):
    sol = _sample_by_step(solution_result)
    final = sol[240]
    pos = final["position"]
    vel = final["velocity"]
    assert abs(float(vel[1])) > 1e-3, (
        "Final Y velocity is ~0: the +Y updraft field (B) never affected the probe, "
        "which usually means the probe is not detected by the fields (collision "
        "layer/mask or sleeping body)."
    )
    assert abs(float(vel[2])) > 1e-3, (
        "Final Z velocity is ~0: the +Z field (C) never affected the probe."
    )
    assert float(pos[0]) > 120.0, (
        "Probe did not travel past X=120 by tick 240; the gravity fields were not "
        f"driving it as specified (final position was {pos})."
    )
