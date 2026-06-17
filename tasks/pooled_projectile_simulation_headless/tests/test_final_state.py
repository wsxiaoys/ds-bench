import glob
import os
import subprocess
from pathlib import Path

import pytest

PROJECT_DIR = "/home/user/projectile_sim"
RUN_SCRIPT = os.path.join(PROJECT_DIR, "run.sh")


def _run_simulation(scenario_path: str, output_path: str) -> subprocess.CompletedProcess:
    """Invoke the executor's run.sh with the standard CLI contract."""
    if os.path.exists(output_path):
        os.remove(output_path)
    return subprocess.run(
        [
            "bash",
            RUN_SCRIPT,
            "--scenario",
            scenario_path,
            "--output",
            output_path,
        ],
        capture_output=True,
        text=True,
        cwd=PROJECT_DIR,
        timeout=900,
    )


def _read_lines(path: str) -> list[str]:
    with open(path, "r", encoding="utf-8") as handle:
        # Strip a single trailing newline so the file may or may not end with "\n".
        content = handle.read()
    if content.endswith("\n"):
        content = content[:-1]
    return content.split("\n")


@pytest.fixture(scope="session")
def warmup() -> None:
    """First Gradle invocation may need to download/compile sources.

    Run an inexpensive build once so that the per-test timeouts are not dominated
    by initial Gradle work. Failures here are not fatal — individual tests will
    still produce their own diagnostics.
    """
    if not os.path.isfile(RUN_SCRIPT):
        return
    scenario = "/tmp/sim_warmup.txt"
    output = "/tmp/sim_warmup.log"
    Path(scenario).write_text(
        "TICKS 1\nGRAVITY 0 0\nFLOOR -100\n", encoding="utf-8"
    )
    if os.path.exists(output):
        os.remove(output)
    subprocess.run(
        ["bash", RUN_SCRIPT, "--scenario", scenario, "--output", output],
        capture_output=True,
        text=True,
        cwd=PROJECT_DIR,
        timeout=900,
        check=False,
    )


def test_run_script_exists():
    assert os.path.isfile(RUN_SCRIPT), f"Expected run.sh at {RUN_SCRIPT}."
    # Bash must be able to read it; the task description requires bash invocation.
    assert os.access(RUN_SCRIPT, os.R_OK), f"{RUN_SCRIPT} is not readable."


def test_empty_scenario(warmup):
    scenario_path = "/tmp/sim_empty.txt"
    output_path = "/tmp/sim_empty.log"
    Path(scenario_path).write_text(
        "TICKS 3\nGRAVITY 0 -1\nFLOOR 0\n", encoding="utf-8"
    )

    result = _run_simulation(scenario_path, output_path)
    assert result.returncode == 0, (
        f"Empty scenario run failed.\nstdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )
    assert os.path.isfile(output_path), f"Output log {output_path} was not produced."

    expected = [
        "TICKS 3",
        "TICK 0 ACTIVE 0",
        "TICK 1 ACTIVE 0",
        "TICK 2 ACTIVE 0",
        "SUMMARY spawned=0 grounded=0 pool_free=0 peak_active=0",
    ]
    actual = _read_lines(output_path)
    assert actual == expected, (
        "Empty-scenario output did not match the required transcript.\n"
        f"Expected:\n{chr(10).join(expected)}\n\nActual:\n{chr(10).join(actual)}"
    )


def test_single_projectile_free_fall(warmup):
    scenario_path = "/tmp/sim_single.txt"
    output_path = "/tmp/sim_single.log"
    Path(scenario_path).write_text(
        "TICKS 4\nGRAVITY 0 -2\nFLOOR 0\nSPAWN 0 0 5 1 3\n",
        encoding="utf-8",
    )

    result = _run_simulation(scenario_path, output_path)
    assert result.returncode == 0, (
        f"Single-projectile run failed.\nstdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )

    expected = [
        "TICKS 4",
        "TICK 0 ACTIVE 1",
        "P0 x=1 y=6 vx=1 vy=1",
        "TICK 1 ACTIVE 1",
        "P0 x=2 y=5 vx=1 vy=-1",
        "TICK 2 ACTIVE 1",
        "P0 x=3 y=2 vx=1 vy=-3",
        "TICK 3 ACTIVE 0",
        "GROUNDED P0 tick=3",
        "SUMMARY spawned=1 grounded=1 pool_free=1 peak_active=1",
    ]
    actual = _read_lines(output_path)
    assert actual == expected, (
        "Single-projectile transcript did not match the expected trace.\n"
        f"Expected:\n{chr(10).join(expected)}\n\nActual:\n{chr(10).join(actual)}"
    )


def test_pool_reuse(warmup):
    scenario_path = "/tmp/sim_pool_reuse.txt"
    output_path = "/tmp/sim_pool_reuse.log"
    Path(scenario_path).write_text(
        "TICKS 6\nGRAVITY 0 -5\nFLOOR 0\nSPAWN 0 0 5 0 0\nSPAWN 2 10 5 0 0\n",
        encoding="utf-8",
    )

    result = _run_simulation(scenario_path, output_path)
    assert result.returncode == 0, (
        f"Pool-reuse run failed.\nstdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )

    expected = [
        "TICKS 6",
        "TICK 0 ACTIVE 0",
        "GROUNDED P0 tick=0",
        "TICK 1 ACTIVE 0",
        "TICK 2 ACTIVE 0",
        "GROUNDED P1 tick=2",
        "TICK 3 ACTIVE 0",
        "TICK 4 ACTIVE 0",
        "TICK 5 ACTIVE 0",
        "SUMMARY spawned=2 grounded=2 pool_free=1 peak_active=1",
    ]
    actual = _read_lines(output_path)
    assert actual == expected, (
        "Pool-reuse transcript did not match the expected trace.\n"
        f"Expected:\n{chr(10).join(expected)}\n\nActual:\n{chr(10).join(actual)}"
    )


def test_no_lwjgl3_backend_is_used():
    matches: list[str] = []
    for java_file in glob.glob(
        os.path.join(PROJECT_DIR, "**", "*.java"), recursive=True
    ):
        try:
            content = Path(java_file).read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        if "Lwjgl3Application" in content:
            matches.append(java_file)
    assert matches == [], (
        "The LWJGL3 desktop backend must not be used; the task requires the "
        f"headless backend. Found references in: {matches}"
    )


def test_headless_backend_is_used():
    found = False
    for java_file in glob.glob(
        os.path.join(PROJECT_DIR, "**", "*.java"), recursive=True
    ):
        try:
            content = Path(java_file).read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        if "com.badlogic.gdx.backends.headless.HeadlessApplication" in content:
            found = True
            break
    assert found, (
        "Expected at least one Java source under "
        f"{PROJECT_DIR} to reference com.badlogic.gdx.backends.headless.HeadlessApplication."
    )
