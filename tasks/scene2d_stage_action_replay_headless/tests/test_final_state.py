import os
import re
import subprocess
from pathlib import Path

import pytest


PROJECT_DIR = "/home/user/gdx-stage-sim"
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


def _parse_output_file(path: str) -> list[tuple[str, str, str]]:
    """Parse `<id>=<x>,<y>` lines from the simulation output file (preserving order)."""
    assert os.path.isfile(path), f"Expected simulation output file at {path}, but it does not exist."
    result: list[tuple[str, str, str]] = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.rstrip("\r\n")
            if not line:
                continue
            assert "=" in line, f"Malformed line in {path!r}: {line!r}. Expected `<id>=<x>,<y>`."
            key, value = line.split("=", 1)
            assert "," in value, f"Malformed value in {path!r}: {line!r}. Expected `<x>,<y>`."
            x, y = value.split(",", 1)
            result.append((key.strip(), x.strip(), y.strip()))
    return result


def _assert_close(actual: str, expected: float, tol: float, key: str, axis: str, path: str) -> None:
    try:
        actual_f = float(actual)
    except ValueError as e:
        pytest.fail(f"Could not parse {key} {axis}={actual!r} as float from {path}: {e}")
    assert abs(actual_f - expected) <= tol, (
        f"{path}: {key} {axis}={actual_f!r} differs from expected {expected!r} by more than {tol} (tol)."
    )


def _write_script(path: str, body: str) -> None:
    Path(path).write_text(body, encoding="utf-8")


def _run_simulation(script_path: str, output_path: str) -> subprocess.CompletedProcess[str]:
    args = f"{script_path} {output_path}"
    return _run(
        _gradle_cmd("--no-daemon", "-q", "run", f"--args={args}"),
        timeout=300,
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


def _collect_gradle_text() -> str:
    contents = ""
    for root, _, files in os.walk(PROJECT_DIR):
        if any(part in root for part in (".gradle", "build", "node_modules")):
            continue
        for name in files:
            if name.endswith((".gradle", ".gradle.kts")):
                p = os.path.join(root, name)
                try:
                    with open(p, "r", encoding="utf-8") as f:
                        contents += f.read() + "\n"
                except OSError:
                    pass
    return contents


def _collect_source_text() -> str:
    contents = ""
    for root, _, files in os.walk(PROJECT_DIR):
        if any(part in root for part in (".gradle", "build")):
            continue
        for name in files:
            if not name.endswith((".java", ".kt")):
                continue
            p = os.path.join(root, name)
            try:
                with open(p, "r", encoding="utf-8") as f:
                    contents += f.read() + "\n"
            except OSError:
                pass
    return contents


def test_build_script_declares_headless_backend():
    gradle_text = _collect_gradle_text()
    assert "gdx-backend-headless" in gradle_text, (
        "Expected the project's Gradle build script(s) to declare a dependency on "
        "`com.badlogicgames.gdx:gdx-backend-headless`."
    )


def test_uses_headless_application_in_source():
    """The implementation must actually use HeadlessApplication from the headless backend."""
    source = _collect_source_text()
    assert "HeadlessApplication" in source, (
        "No source file under the project references `HeadlessApplication`. The task "
        "requires bootstrapping a libGDX headless app, so this class must appear in the source."
    )


def test_uses_scene2d_in_source():
    """The implementation must actually use Scene2D's Actor/Action package."""
    source = _collect_source_text()
    assert "com.badlogic.gdx.scenes.scene2d" in source, (
        "No source file under the project references the `com.badlogic.gdx.scenes.scene2d` package. "
        "The task requires modelling actors and actions with Scene2D classes."
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
# 2. Test cases A, B, C, D
# ---------------------------------------------------------------------------

def test_case_a_single_actor_full_move(tmp_path):
    script_path = "/tmp/scene2d_script_a.txt"
    output_path = "/tmp/scene2d_out_a.txt"
    if os.path.exists(output_path):
        os.remove(output_path)

    _write_script(
        script_path,
        "# single-actor full-duration move\n"
        "dt 0.1\n"
        "ticks 10\n"
        "actor A 0.0 0.0\n"
        "moveby A 10.0 0.0 1.0\n",
    )

    proc = _run_simulation(script_path, output_path)
    assert proc.returncode == 0, (
        f"Simulation case A exited with {proc.returncode}.\nSTDOUT:\n{proc.stdout}\nSTDERR:\n{proc.stderr}"
    )

    rows = _parse_output_file(output_path)
    assert [r[0] for r in rows] == ["A"], (
        f"{output_path}: expected exactly one row for actor 'A', got rows: {rows!r}"
    )
    _assert_close(rows[0][1], 10.0, 1e-3, "A", "x", output_path)
    _assert_close(rows[0][2], 0.0, 1e-3, "A", "y", output_path)


def test_case_b_two_actors_different_durations(tmp_path):
    script_path = "/tmp/scene2d_script_b.txt"
    output_path = "/tmp/scene2d_out_b.txt"
    if os.path.exists(output_path):
        os.remove(output_path)

    _write_script(
        script_path,
        "# A finishes at t=0.5s; B finishes exactly at the last tick (t=1.0s)\n"
        "dt 0.25\n"
        "ticks 4\n"
        "actor A 0.0 0.0\n"
        "actor B 5.0 5.0\n"
        "moveby A 2.0 3.0 0.5\n"
        "moveby B -1.0 0.0 1.0\n",
    )

    proc = _run_simulation(script_path, output_path)
    assert proc.returncode == 0, (
        f"Simulation case B exited with {proc.returncode}.\nSTDOUT:\n{proc.stdout}\nSTDERR:\n{proc.stderr}"
    )

    rows = _parse_output_file(output_path)
    assert [r[0] for r in rows] == ["A", "B"], (
        f"{output_path}: expected rows in order ['A', 'B'], got: {[r[0] for r in rows]!r}"
    )
    _assert_close(rows[0][1], 2.0, 1e-3, "A", "x", output_path)
    _assert_close(rows[0][2], 3.0, 1e-3, "A", "y", output_path)
    _assert_close(rows[1][1], 4.0, 1e-3, "B", "x", output_path)
    _assert_close(rows[1][2], 5.0, 1e-3, "B", "y", output_path)


def test_case_c_comments_blank_lines_mixed_case(tmp_path):
    script_path = "/tmp/scene2d_script_c.txt"
    output_path = "/tmp/scene2d_out_c.txt"
    if os.path.exists(output_path):
        os.remove(output_path)

    _write_script(
        script_path,
        "# mixed-case directives and idle actors\n"
        "DT 0.2\n"
        "\n"
        "TICKS 5\n"
        "# actor with no moveby\n"
        "Actor Idle 1.5 -2.5\n"
        "ACTOR Mover 0.0 0.0\n"
        "# half-duration: with dt=0.2 and duration=0.5, action completes between\n"
        "# ticks 2 and 3 (cumulative time crosses 0.5s).\n"
        "MoveBy Mover 4.0 -2.0 0.5\n",
    )

    proc = _run_simulation(script_path, output_path)
    assert proc.returncode == 0, (
        f"Simulation case C exited with {proc.returncode}.\nSTDOUT:\n{proc.stdout}\nSTDERR:\n{proc.stderr}"
    )

    rows = _parse_output_file(output_path)
    assert [r[0] for r in rows] == ["Idle", "Mover"], (
        f"{output_path}: expected rows in order ['Idle', 'Mover'], got: {[r[0] for r in rows]!r}"
    )
    _assert_close(rows[0][1], 1.5, 1e-3, "Idle", "x", output_path)
    _assert_close(rows[0][2], -2.5, 1e-3, "Idle", "y", output_path)
    _assert_close(rows[1][1], 4.0, 1e-3, "Mover", "x", output_path)
    _assert_close(rows[1][2], -2.0, 1e-3, "Mover", "y", output_path)


def test_case_d_ticks_zero_preserves_initial_state(tmp_path):
    script_path = "/tmp/scene2d_script_d.txt"
    output_path = "/tmp/scene2d_out_d.txt"
    if os.path.exists(output_path):
        os.remove(output_path)

    _write_script(
        script_path,
        "dt 0.05\n"
        "ticks 0\n"
        "actor First 7.5 -3.5\n"
        "actor Second 1.25 2.5\n"
        "moveby First 100.0 -100.0 1.0\n",
    )

    proc = _run_simulation(script_path, output_path)
    assert proc.returncode == 0, (
        f"Simulation case D exited with {proc.returncode}.\nSTDOUT:\n{proc.stdout}\nSTDERR:\n{proc.stderr}"
    )

    rows = _parse_output_file(output_path)
    assert [r[0] for r in rows] == ["First", "Second"], (
        f"{output_path}: expected rows in order ['First', 'Second'], got: {[r[0] for r in rows]!r}"
    )
    _assert_close(rows[0][1], 7.5, 1e-3, "First", "x", output_path)
    _assert_close(rows[0][2], -3.5, 1e-3, "First", "y", output_path)
    _assert_close(rows[1][1], 1.25, 1e-3, "Second", "x", output_path)
    _assert_close(rows[1][2], 2.5, 1e-3, "Second", "y", output_path)
