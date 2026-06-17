import os
import re
import subprocess
from pathlib import Path

import pytest


PROJECT_DIR = "/home/user/gdx-interp"
GRADLEW = os.path.join(PROJECT_DIR, "gradlew")


def _gradle_cmd(*args: str) -> list[str]:
    """Use the project's gradlew if present, otherwise fall back to the system gradle."""
    if os.path.isfile(GRADLEW) and os.access(GRADLEW, os.X_OK):
        return [GRADLEW, *args]
    return ["gradle", *args]


def _run(cmd: list[str], cwd: str = PROJECT_DIR, timeout: int = 600) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        cmd,
        cwd=cwd,
        capture_output=True,
        text=True,
        timeout=timeout,
    )


def _write_config(path: str, body: str) -> None:
    Path(path).write_text(body, encoding="utf-8")


def _run_sampler(config_path: str, output_path: str) -> subprocess.CompletedProcess[str]:
    args = f"{config_path} {output_path}"
    return _run(
        _gradle_cmd("--no-daemon", "-q", "run", f"--args={args}"),
        timeout=300,
    )


def _parse_output_file(path: str) -> tuple[str, int, list[float]]:
    """Parse the sampler output file.

    Returns (curve_name, samples_declared, list_of_sample_values).
    """
    assert os.path.isfile(path), f"Expected sampler output file at {path}, but it does not exist."
    with open(path, "r", encoding="utf-8", newline="") as f:
        raw = f.read()
    # The file must end with a trailing newline per the acceptance criteria.
    assert raw.endswith("\n"), f"{path}: file must end with a trailing newline."
    lines = raw.splitlines()
    assert len(lines) >= 3, (
        f"{path}: expected at least 3 lines (curve, samples, >=1 value), got {len(lines)}."
    )
    assert lines[0].startswith("curve="), (
        f"{path}: line 1 must start with 'curve=', got {lines[0]!r}."
    )
    curve = lines[0][len("curve="):].strip()
    assert lines[1].startswith("samples="), (
        f"{path}: line 2 must start with 'samples=', got {lines[1]!r}."
    )
    samples_declared = 0
    try:
        samples_declared = int(lines[1][len("samples="):].strip())
    except ValueError:
        pytest.fail(f"{path}: cannot parse samples count from {lines[1]!r}.")
    body = lines[2:]
    assert len(body) == samples_declared, (
        f"{path}: header declares samples={samples_declared} but body has {len(body)} value lines."
    )
    values: list[float] = []
    for i, line in enumerate(body):
        try:
            values.append(float(line.strip()))
        except ValueError:
            pytest.fail(f"{path}: cannot parse sample #{i} from line {line!r}.")
    return curve, samples_declared, values


def _assert_values_close(actual: list[float], expected: list[float], tol: float, path: str) -> None:
    assert len(actual) == len(expected), (
        f"{path}: expected {len(expected)} samples, got {len(actual)}."
    )
    for i, (a, e) in enumerate(zip(actual, expected)):
        assert abs(a - e) <= tol, (
            f"{path}: sample #{i} = {a!r} differs from expected {e!r} by more than {tol} (tol)."
        )


# ---------------------------------------------------------------------------
# 1. Project structure / build sanity
# ---------------------------------------------------------------------------

def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_build_script_present():
    candidates = [
        os.path.join(PROJECT_DIR, "build.gradle"),
        os.path.join(PROJECT_DIR, "build.gradle.kts"),
    ]
    assert any(os.path.isfile(c) for c in candidates), (
        f"No build.gradle or build.gradle.kts found in {PROJECT_DIR}."
    )


def _read_all_gradle_files() -> str:
    contents = ""
    for c in (
        os.path.join(PROJECT_DIR, "build.gradle"),
        os.path.join(PROJECT_DIR, "build.gradle.kts"),
    ):
        if os.path.isfile(c):
            with open(c, "r", encoding="utf-8") as f:
                contents += f.read() + "\n"
    for root, _, files in os.walk(PROJECT_DIR):
        if any(part in root for part in (".gradle", "build", "node_modules")):
            continue
        for name in files:
            if name.endswith((".gradle", ".gradle.kts")) and name not in (
                "build.gradle",
                "build.gradle.kts",
            ):
                p = os.path.join(root, name)
                try:
                    with open(p, "r", encoding="utf-8") as f:
                        contents += f.read() + "\n"
                except OSError:
                    pass
    return contents


def test_build_script_declares_headless_backend():
    contents = _read_all_gradle_files()
    assert "gdx-backend-headless" in contents, (
        "Expected the project's Gradle build script(s) to declare a dependency on "
        "`com.badlogicgames.gdx:gdx-backend-headless`."
    )


def _scan_source_for(pattern: str) -> bool:
    for root, _, files in os.walk(PROJECT_DIR):
        if any(part in root for part in (".gradle", "build")):
            continue
        for name in files:
            if not name.endswith((".java", ".kt")):
                continue
            p = os.path.join(root, name)
            try:
                with open(p, "r", encoding="utf-8") as f:
                    text = f.read()
            except OSError:
                continue
            if pattern in text:
                return True
    return False


def test_uses_headless_application_in_source():
    """The implementation must actually use HeadlessApplication from the headless backend."""
    assert _scan_source_for("HeadlessApplication"), (
        "No source file under the project references `HeadlessApplication`. The task "
        "requires bootstrapping a libGDX headless app, so this class must appear in the source."
    )


def test_uses_interpolation_in_source():
    """The implementation must use the libGDX Interpolation API."""
    assert _scan_source_for("com.badlogic.gdx.math.Interpolation"), (
        "No source file under the project imports `com.badlogic.gdx.math.Interpolation`. "
        "The task requires sampling values via the libGDX Interpolation API."
    )


def test_gradle_build_succeeds():
    result = _run(_gradle_cmd("--no-daemon", "build", "-x", "test"), timeout=900)
    assert result.returncode == 0, (
        f"Gradle build failed (exit {result.returncode}).\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
    )


def test_run_task_exists():
    result = _run(_gradle_cmd("--no-daemon", "tasks", "--all"), timeout=300)
    assert result.returncode == 0, (
        f"`gradle tasks --all` failed (exit {result.returncode}).\nSTDERR:\n{result.stderr}"
    )
    assert re.search(r"(?m)^run\b", result.stdout) is not None, (
        "Expected a Gradle `run` task to be available (from the `application` plugin). "
        f"`tasks --all` output did not contain it:\n{result.stdout}"
    )


# ---------------------------------------------------------------------------
# 2. Functional test cases
# ---------------------------------------------------------------------------

def test_case_a_linear_eleven_samples():
    config_path = "/tmp/interp_cfg_a.properties"
    output_path = "/tmp/interp_out_a.txt"
    if os.path.exists(output_path):
        os.remove(output_path)

    _write_config(
        config_path,
        "curve=linear\n"
        "start=0.0\n"
        "end=10.0\n"
        "samples=11\n",
    )

    proc = _run_sampler(config_path, output_path)
    assert proc.returncode == 0, (
        f"Sampler case A exited with {proc.returncode}.\nSTDOUT:\n{proc.stdout}\nSTDERR:\n{proc.stderr}"
    )

    curve, samples, values = _parse_output_file(output_path)
    assert curve == "linear", f"{output_path}: expected curve=linear, got curve={curve!r}."
    assert samples == 11, f"{output_path}: expected samples=11, got samples={samples}."
    _assert_values_close(values, [float(i) for i in range(11)], 1e-4, output_path)


def test_case_b_smooth_five_samples():
    config_path = "/tmp/interp_cfg_b.properties"
    output_path = "/tmp/interp_out_b.txt"
    if os.path.exists(output_path):
        os.remove(output_path)

    _write_config(
        config_path,
        "curve=smooth\n"
        "start=0.0\n"
        "end=1.0\n"
        "samples=5\n",
    )

    proc = _run_sampler(config_path, output_path)
    assert proc.returncode == 0, (
        f"Sampler case B exited with {proc.returncode}.\nSTDOUT:\n{proc.stdout}\nSTDERR:\n{proc.stderr}"
    )

    curve, samples, values = _parse_output_file(output_path)
    assert curve == "smooth", f"{output_path}: expected curve=smooth, got curve={curve!r}."
    assert samples == 5, f"{output_path}: expected samples=5, got samples={samples}."
    # smoothstep: a*a*(3-2a) at t = 0, 0.25, 0.5, 0.75, 1
    _assert_values_close(values, [0.0, 0.15625, 0.5, 0.84375, 1.0], 1e-4, output_path)


def test_case_c_smoother_three_samples_shifted_range():
    config_path = "/tmp/interp_cfg_c.properties"
    output_path = "/tmp/interp_out_c.txt"
    if os.path.exists(output_path):
        os.remove(output_path)

    _write_config(
        config_path,
        "curve=smoother\n"
        "start=10.0\n"
        "end=20.0\n"
        "samples=3\n",
    )

    proc = _run_sampler(config_path, output_path)
    assert proc.returncode == 0, (
        f"Sampler case C exited with {proc.returncode}.\nSTDOUT:\n{proc.stdout}\nSTDERR:\n{proc.stderr}"
    )

    curve, samples, values = _parse_output_file(output_path)
    assert curve == "smoother", f"{output_path}: expected curve=smoother, got curve={curve!r}."
    assert samples == 3, f"{output_path}: expected samples=3, got samples={samples}."
    # smootherstep: a*a*a*(a*(a*6-15)+10) at t = 0, 0.5, 1 → 0, 0.5, 1
    _assert_values_close(values, [10.0, 15.0, 20.0], 1e-4, output_path)


def test_case_d_invalid_curve_fails_without_output():
    config_path = "/tmp/interp_cfg_d.properties"
    output_path = "/tmp/interp_out_d.txt"
    if os.path.exists(output_path):
        os.remove(output_path)

    _write_config(
        config_path,
        "curve=bogus\n"
        "start=0.0\n"
        "end=1.0\n"
        "samples=4\n",
    )

    proc = _run_sampler(config_path, output_path)
    assert proc.returncode != 0, (
        "Sampler case D should have failed for an unknown curve name, but it exited 0.\n"
        f"STDOUT:\n{proc.stdout}\nSTDERR:\n{proc.stderr}"
    )
    assert not os.path.exists(output_path), (
        f"{output_path} must not be created when the curve name is invalid."
    )
