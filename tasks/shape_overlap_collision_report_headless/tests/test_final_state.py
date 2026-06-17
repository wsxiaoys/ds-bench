import os
import shutil
import subprocess
import tempfile

import pytest


PROJECT_DIR = "/home/user/gdx-game"
LAUNCHER = os.path.join(PROJECT_DIR, "build", "install", "gdx-game", "bin", "gdx-game")
GRADLEW = os.path.join(PROJECT_DIR, "gradlew")
BUILD_TIMEOUT = 600  # seconds
RUN_TIMEOUT = 120  # seconds


@pytest.fixture(scope="session", autouse=True)
def _build_distribution():
    """Build the runnable distribution before running any test."""
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR!r} does not exist; the executor never created it."
    )
    assert os.path.isfile(GRADLEW) and os.access(GRADLEW, os.X_OK), (
        f"Gradle wrapper {GRADLEW!r} is missing or not executable; "
        "the executor must bootstrap it via `gradle wrapper`."
    )

    result = subprocess.run(
        [GRADLEW, "--no-daemon", "--quiet", "installDist"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=BUILD_TIMEOUT,
    )
    assert result.returncode == 0, (
        "`./gradlew --no-daemon --quiet installDist` failed.\n"
        f"stdout:\n{result.stdout}\n"
        f"stderr:\n{result.stderr}"
    )

    assert os.path.isfile(LAUNCHER) and os.access(LAUNCHER, os.X_OK), (
        f"Expected runnable launcher at {LAUNCHER!r} after `installDist`, "
        "but the file is missing or not executable."
    )

    yield


@pytest.fixture()
def fixtures_dir():
    tmp = tempfile.mkdtemp(prefix="gdx-shapes-")
    try:
        yield tmp
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def _write_fixture(directory: str, name: str, content: str) -> str:
    path = os.path.join(directory, name)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(content)
    return path


def _run_launcher(shapes_path: str, output_path: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [LAUNCHER, f"--shapes={shapes_path}", f"--output={output_path}"],
        capture_output=True,
        text=True,
        timeout=RUN_TIMEOUT,
    )


def test_empty_report_when_no_shapes(fixtures_dir):
    shapes = _write_fixture(
        fixtures_dir,
        "empty.txt",
        "# only comments\n# no shapes at all\n",
    )
    output = os.path.join(fixtures_dir, "empty.out")
    result = _run_launcher(shapes, output)

    assert result.returncode == 0, (
        "Launcher exited non-zero on a shapes file with no shapes.\n"
        f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )
    assert os.path.isfile(output), (
        f"Expected output file {output!r} to be created on a successful run, "
        "but it does not exist."
    )
    with open(output, "r", encoding="utf-8") as fh:
        content = fh.read()
    assert content == "total_overlaps=0\n", (
        "A shapes file containing only comments should produce exactly "
        "`total_overlaps=0\\n` in the output file, but got:\n"
        f"{content!r}"
    )


def test_two_rectangles_one_pair(fixtures_dir):
    shapes = _write_fixture(
        fixtures_dir,
        "rects.txt",
        (
            "A rect 0 0 10 10\n"
            "B rect 5 5 10 10\n"
            "C rect 100 100 5 5\n"
        ),
    )
    output = os.path.join(fixtures_dir, "rects.out")
    result = _run_launcher(shapes, output)

    assert result.returncode == 0, (
        "Launcher exited non-zero on a valid rectangles fixture.\n"
        f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )
    with open(output, "r", encoding="utf-8") as fh:
        content = fh.read()
    expected = "A\tB\ntotal_overlaps=1\n"
    assert content == expected, (
        "Expected the rectangles fixture to produce exactly one overlap A/B "
        "and a total_overlaps=1 summary, formatted as "
        f"{expected!r}, but got:\n{content!r}"
    )


def test_mixed_shapes_sorted_pairs(fixtures_dir):
    shapes = _write_fixture(
        fixtures_dir,
        "mixed.txt",
        (
            "# comment\n"
            "R1 rect 0 0 10 10\n"
            "R2 rect 8 8 4 4\n"
            "C1 circle 5 5 2\n"
            "C2 circle 50 50 3\n"
            "C3 circle 53 50 2\n"
            "R3 rect 51 49 3 3\n"
        ),
    )
    output = os.path.join(fixtures_dir, "mixed.out")
    result = _run_launcher(shapes, output)

    assert result.returncode == 0, (
        "Launcher exited non-zero on a valid mixed-shapes fixture.\n"
        f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )
    with open(output, "r", encoding="utf-8") as fh:
        content = fh.read()
    expected = (
        "C1\tR1\n"
        "C2\tC3\n"
        "C2\tR3\n"
        "C3\tR3\n"
        "R1\tR2\n"
        "total_overlaps=5\n"
    )
    assert content == expected, (
        "Expected the mixed shapes fixture to produce the canonical 5-pair "
        "sorted report, formatted as:\n"
        f"{expected!r}\n"
        "but got:\n"
        f"{content!r}"
    )


def test_duplicate_id_triggers_error(fixtures_dir):
    shapes = _write_fixture(
        fixtures_dir,
        "dup.txt",
        (
            "A rect 0 0 5 5\n"
            "A rect 1 1 2 2\n"
        ),
    )
    output = os.path.join(fixtures_dir, "dup.out")
    result = _run_launcher(shapes, output)

    assert result.returncode != 0, (
        "Launcher must exit with a non-zero status code when the input "
        "contains duplicate shape IDs. Got exit code 0.\n"
        f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )
    assert "Error: duplicate id A" in result.stderr, (
        "Launcher must report duplicate IDs on stderr in the format "
        "`Error: duplicate id <id>`. Got stderr:\n"
        f"{result.stderr}"
    )
    if os.path.isfile(output):
        with open(output, "r", encoding="utf-8") as fh:
            content = fh.read()
        assert "total_overlaps=" not in content, (
            "Launcher must NOT write a `total_overlaps=` summary when the "
            "input contains duplicate IDs. Got output file content:\n"
            f"{content!r}"
        )


def test_malformed_shape_triggers_error(fixtures_dir):
    shapes = _write_fixture(
        fixtures_dir,
        "bad.txt",
        (
            "A rect 0 0 10 10\n"
            "B square 0 0 5\n"
        ),
    )
    output = os.path.join(fixtures_dir, "bad.out")
    result = _run_launcher(shapes, output)

    assert result.returncode != 0, (
        "Launcher must exit with a non-zero status code when the input "
        "contains a malformed shape line. Got exit code 0.\n"
        f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )
    assert "Error: invalid shape line: B square 0 0 5" in result.stderr, (
        "Launcher must report malformed shape lines on stderr in the format "
        "`Error: invalid shape line: <line>`, echoing the offending line "
        "verbatim. Got stderr:\n"
        f"{result.stderr}"
    )
    if os.path.isfile(output):
        with open(output, "r", encoding="utf-8") as fh:
            content = fh.read()
        assert "total_overlaps=" not in content, (
            "Launcher must NOT write a `total_overlaps=` summary when the "
            "input contains a malformed shape line. Got output file content:\n"
            f"{content!r}"
        )


def test_no_overlaps_yields_zero_summary(fixtures_dir):
    shapes = _write_fixture(
        fixtures_dir,
        "none.txt",
        (
            "A rect 0 0 1 1\n"
            "B rect 100 100 1 1\n"
            "C circle 50 50 0.5\n"
        ),
    )
    output = os.path.join(fixtures_dir, "none.out")
    result = _run_launcher(shapes, output)

    assert result.returncode == 0, (
        "Launcher exited non-zero on a valid no-overlap fixture.\n"
        f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )
    with open(output, "r", encoding="utf-8") as fh:
        content = fh.read()
    assert content == "total_overlaps=0\n", (
        "A shapes file with no overlapping pairs should produce exactly "
        f"`total_overlaps=0\\n` in the output file, but got:\n{content!r}"
    )
