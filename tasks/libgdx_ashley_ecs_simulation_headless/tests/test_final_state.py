import os
import re
import shutil
import subprocess
from pathlib import Path

import pytest


PROJECT_DIR = "/home/user/gdx-ecs"
RUN_SH = os.path.join(PROJECT_DIR, "run.sh")


def _run_scenario(scenario_text: str, scenario_path: str) -> subprocess.CompletedProcess:
    """Write the scenario file and invoke run.sh, returning the process result.

    We deliberately discard stderr (Gradle progress, JVM banners) and only check stdout
    against the expected exact output.
    """
    Path(scenario_path).write_text(scenario_text, encoding="utf-8")
    return subprocess.run(
        ["bash", RUN_SH, scenario_path],
        capture_output=True,
        text=True,
        timeout=600,
        cwd=PROJECT_DIR,
    )


def test_run_sh_exists():
    assert os.path.isfile(RUN_SH), f"Expected entry-point script at {RUN_SH}."


def test_case1_basic_two_entities():
    scenario_path = "/tmp/scenario_case1.txt"
    if os.path.exists(scenario_path):
        os.remove(scenario_path)

    scenario = (
        "# case 1\n"
        "TICKS 60\n"
        "ENTITY A 0.0 0.0 1.0 0.5\n"
        "ENTITY B 10.0 -5.0 -2.0 3.0\n"
    )
    result = _run_scenario(scenario, scenario_path)
    assert result.returncode == 0, (
        f"run.sh exited with {result.returncode}. stderr=\n{result.stderr}"
    )
    expected = (
        "TICK_COUNT 60\n"
        "ENTITY A x=1.000 y=0.500\n"
        "ENTITY B x=8.000 y=-2.000\n"
    )
    assert result.stdout == expected, (
        f"Case 1 stdout mismatch.\nExpected:\n{expected!r}\nGot:\n{result.stdout!r}\n"
        f"stderr=\n{result.stderr}"
    )


def test_case2_zero_ticks_preserves_positions():
    scenario_path = "/tmp/scenario_case2.txt"
    if os.path.exists(scenario_path):
        os.remove(scenario_path)

    scenario = (
        "TICKS 0\n"
        "ENTITY P 3.5 -7.25 100.0 100.0\n"
        "ENTITY Q -1.0 0.0 0.0 0.0\n"
    )
    result = _run_scenario(scenario, scenario_path)
    assert result.returncode == 0, (
        f"run.sh exited with {result.returncode}. stderr=\n{result.stderr}"
    )
    expected = (
        "TICK_COUNT 0\n"
        "ENTITY P x=3.500 y=-7.250\n"
        "ENTITY Q x=-1.000 y=0.000\n"
    )
    assert result.stdout == expected, (
        f"Case 2 stdout mismatch.\nExpected:\n{expected!r}\nGot:\n{result.stdout!r}\n"
        f"stderr=\n{result.stderr}"
    )


def test_case3_no_entities_only_tick_count():
    scenario_path = "/tmp/scenario_case3.txt"
    if os.path.exists(scenario_path):
        os.remove(scenario_path)

    scenario = (
        "# empty world\n"
        "\n"
        "TICKS 30\n"
    )
    result = _run_scenario(scenario, scenario_path)
    assert result.returncode == 0, (
        f"run.sh exited with {result.returncode}. stderr=\n{result.stderr}"
    )
    expected = "TICK_COUNT 30\n"
    assert result.stdout == expected, (
        f"Case 3 stdout mismatch.\nExpected:\n{expected!r}\nGot:\n{result.stdout!r}\n"
        f"stderr=\n{result.stderr}"
    )


def test_case4_multi_second_preserves_order():
    scenario_path = "/tmp/scenario_case4.txt"
    if os.path.exists(scenario_path):
        os.remove(scenario_path)

    scenario = (
        "TICKS 120\n"
        "ENTITY zulu 100.0 100.0 0.0 0.0\n"
        "ENTITY alpha 0.0 0.0 1.0 -0.5\n"
        "ENTITY mid -50.0 50.0 25.0 -25.0\n"
    )
    result = _run_scenario(scenario, scenario_path)
    assert result.returncode == 0, (
        f"run.sh exited with {result.returncode}. stderr=\n{result.stderr}"
    )
    expected = (
        "TICK_COUNT 120\n"
        "ENTITY zulu x=100.000 y=100.000\n"
        "ENTITY alpha x=2.000 y=-1.000\n"
        "ENTITY mid x=0.000 y=0.000\n"
    )
    assert result.stdout == expected, (
        f"Case 4 stdout mismatch.\nExpected:\n{expected!r}\nGot:\n{result.stdout!r}\n"
        f"stderr=\n{result.stderr}"
    )


def _collect_source_files() -> list[str]:
    """Return all .java/.kt/.scala source files under the project, skipping build artifacts."""
    sources: list[str] = []
    skip_dirs = {"build", ".gradle", "node_modules", ".git", "out", "dist"}
    for root, dirs, files in os.walk(PROJECT_DIR):
        dirs[:] = [d for d in dirs if d not in skip_dirs]
        for name in files:
            if name.endswith((".java", ".kt", ".scala", ".groovy")):
                sources.append(os.path.join(root, name))
    return sources


def test_ashley_component_used():
    sources = _collect_source_files()
    assert sources, f"No JVM source files found under {PROJECT_DIR}."
    pattern = re.compile(r"\bcom\.badlogic\.ashley\.core\.Component\b")
    matched = [p for p in sources if pattern.search(Path(p).read_text(encoding="utf-8", errors="ignore"))]
    assert matched, (
        "Expected at least one source file to import com.badlogic.ashley.core.Component, "
        "indicating the Ashley ECS extension is in use."
    )


def test_ashley_entity_system_used():
    sources = _collect_source_files()
    assert sources, f"No JVM source files found under {PROJECT_DIR}."
    pattern = re.compile(r"\bcom\.badlogic\.ashley\.(core|systems)\.[A-Za-z0-9_]*System\b")
    matched = [p for p in sources if pattern.search(Path(p).read_text(encoding="utf-8", errors="ignore"))]
    assert matched, (
        "Expected at least one source file to import an Ashley *System class "
        "(e.g. com.badlogic.ashley.core.EntitySystem or com.badlogic.ashley.systems.IteratingSystem)."
    )


def test_headless_backend_used():
    sources = _collect_source_files()
    assert sources, f"No JVM source files found under {PROJECT_DIR}."
    pattern = re.compile(r"\bcom\.badlogic\.gdx\.backends\.headless\.HeadlessApplication\b")
    matched = [p for p in sources if pattern.search(Path(p).read_text(encoding="utf-8", errors="ignore"))]
    assert matched, (
        "Expected at least one source file to import "
        "com.badlogic.gdx.backends.headless.HeadlessApplication."
    )


def test_lwjgl_backend_not_used():
    sources = _collect_source_files()
    pattern = re.compile(r"\bcom\.badlogic\.gdx\.backends\.lwjgl3?\b")
    offending = [
        p for p in sources
        if pattern.search(Path(p).read_text(encoding="utf-8", errors="ignore"))
    ]
    assert not offending, (
        "Source files must not import the LWJGL/LWJGL3 desktop backends; "
        f"found offending files: {offending}"
    )
