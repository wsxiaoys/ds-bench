import os
import re
import subprocess
from pathlib import Path

import pytest


PROJECT_DIR = "/home/user/gdx-sim"
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


def _parse_output_file(path: str) -> dict[str, str]:
    """Parse `key=value` lines from the simulation output file."""
    assert os.path.isfile(path), f"Expected simulation output file at {path}, but it does not exist."
    result: dict[str, str] = {}
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.rstrip("\r\n")
            if not line:
                continue
            assert "=" in line, f"Malformed line in {path!r}: {line!r}. Expected `key=value`."
            k, v = line.split("=", 1)
            result[k.strip()] = v.strip()
    return result


def _assert_close(actual: str, expected: float, tol: float, key: str, path: str) -> None:
    try:
        actual_f = float(actual)
    except ValueError as e:
        pytest.fail(f"Could not parse {key}={actual!r} as float from {path}: {e}")
    assert abs(actual_f - expected) <= tol, (
        f"{path}: {key}={actual_f!r} differs from expected {expected!r} by more than {tol} (tol)."
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


def test_build_script_declares_headless_backend():
    candidates = [
        os.path.join(PROJECT_DIR, "build.gradle"),
        os.path.join(PROJECT_DIR, "build.gradle.kts"),
    ]
    contents = ""
    for c in candidates:
        if os.path.isfile(c):
            with open(c, "r", encoding="utf-8") as f:
                contents += f.read() + "\n"
    # Also accept the dependency being declared in a settings include or sub-files.
    # As a safety net, also concatenate any other *.gradle/*.gradle.kts under the project.
    for root, _, files in os.walk(PROJECT_DIR):
        # Skip the Gradle build cache and node_modules-like noise.
        if any(part in root for part in (".gradle", "build", "node_modules")):
            continue
        for name in files:
            if name.endswith((".gradle", ".gradle.kts")) and name not in ("build.gradle", "build.gradle.kts"):
                p = os.path.join(root, name)
                try:
                    with open(p, "r", encoding="utf-8") as f:
                        contents += f.read() + "\n"
                except OSError:
                    pass
    assert "gdx-backend-headless" in contents, (
        "Expected the project's Gradle build script(s) to declare a dependency on "
        "`com.badlogicgames.gdx:gdx-backend-headless`."
    )


def test_uses_headless_application_in_source():
    """The implementation must actually use HeadlessApplication from the headless backend."""
    found = False
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
            if "HeadlessApplication" in text:
                found = True
                break
        if found:
            break
    assert found, (
        "No source file under the project references `HeadlessApplication`. The task "
        "requires bootstrapping a libGDX headless app, so this class must appear in the source."
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
# 2. Test cases A, B, C
# ---------------------------------------------------------------------------

def _write_config(path: str, body: str) -> None:
    Path(path).write_text(body, encoding="utf-8")


def _run_simulation(config_path: str, output_path: str) -> subprocess.CompletedProcess[str]:
    # Use `-q` to suppress Gradle's progress chatter but keep stdout/stderr for debugging.
    args = f"{config_path} {output_path}"
    return _run(
        _gradle_cmd("--no-daemon", "-q", "run", f"--args={args}"),
        timeout=300,
    )


def test_case_a_basic_gravity_fall(tmp_path):
    config_path = "/tmp/sim_cfg_a.properties"
    output_path = "/tmp/sim_out_a.txt"
    if os.path.exists(output_path):
        os.remove(output_path)

    _write_config(
        config_path,
        "ticks=10\n"
        "dt=0.1\n"
        "position_x=0.0\n"
        "position_y=100.0\n"
        "velocity_x=2.0\n"
        "velocity_y=0.0\n"
        "gravity_y=-9.81\n",
    )

    proc = _run_simulation(config_path, output_path)
    assert proc.returncode == 0, (
        f"Simulation case A exited with {proc.returncode}.\nSTDOUT:\n{proc.stdout}\nSTDERR:\n{proc.stderr}"
    )

    parsed = _parse_output_file(output_path)
    _assert_close(parsed.get("final_x", ""), 2.0, 1e-3, "final_x", output_path)
    _assert_close(parsed.get("final_y", ""), 94.6045, 1e-3, "final_y", output_path)
    _assert_close(parsed.get("final_vx", ""), 2.0, 1e-3, "final_vx", output_path)
    _assert_close(parsed.get("final_vy", ""), -9.81, 1e-3, "final_vy", output_path)
    assert parsed.get("ticks") == "10", (
        f"{output_path}: expected ticks=10, got ticks={parsed.get('ticks')!r}"
    )


def test_case_b_zero_ticks_initial_state(tmp_path):
    config_path = "/tmp/sim_cfg_b.properties"
    output_path = "/tmp/sim_out_b.txt"
    if os.path.exists(output_path):
        os.remove(output_path)

    _write_config(
        config_path,
        "ticks=0\n"
        "dt=0.25\n"
        "position_x=7.5\n"
        "position_y=-3.5\n"
        "velocity_x=1.25\n"
        "velocity_y=-2.5\n"
        "gravity_y=-10.0\n",
    )

    proc = _run_simulation(config_path, output_path)
    assert proc.returncode == 0, (
        f"Simulation case B exited with {proc.returncode}.\nSTDOUT:\n{proc.stdout}\nSTDERR:\n{proc.stderr}"
    )

    parsed = _parse_output_file(output_path)
    _assert_close(parsed.get("final_x", ""), 7.5, 1e-3, "final_x", output_path)
    _assert_close(parsed.get("final_y", ""), -3.5, 1e-3, "final_y", output_path)
    _assert_close(parsed.get("final_vx", ""), 1.25, 1e-3, "final_vx", output_path)
    _assert_close(parsed.get("final_vy", ""), -2.5, 1e-3, "final_vy", output_path)
    assert parsed.get("ticks") == "0", (
        f"{output_path}: expected ticks=0, got ticks={parsed.get('ticks')!r}"
    )


def test_case_c_no_gravity_long_run(tmp_path):
    config_path = "/tmp/sim_cfg_c.properties"
    output_path = "/tmp/sim_out_c.txt"
    if os.path.exists(output_path):
        os.remove(output_path)

    _write_config(
        config_path,
        "ticks=100\n"
        "dt=0.05\n"
        "position_x=-5.0\n"
        "position_y=12.0\n"
        "velocity_x=3.0\n"
        "velocity_y=4.0\n"
        "gravity_y=0.0\n",
    )

    proc = _run_simulation(config_path, output_path)
    assert proc.returncode == 0, (
        f"Simulation case C exited with {proc.returncode}.\nSTDOUT:\n{proc.stdout}\nSTDERR:\n{proc.stderr}"
    )

    parsed = _parse_output_file(output_path)
    _assert_close(parsed.get("final_x", ""), 10.0, 1e-3, "final_x", output_path)
    _assert_close(parsed.get("final_y", ""), 32.0, 1e-3, "final_y", output_path)
    _assert_close(parsed.get("final_vx", ""), 3.0, 1e-3, "final_vx", output_path)
    _assert_close(parsed.get("final_vy", ""), 4.0, 1e-3, "final_vy", output_path)
    assert parsed.get("ticks") == "100", (
        f"{output_path}: expected ticks=100, got ticks={parsed.get('ticks')!r}"
    )
