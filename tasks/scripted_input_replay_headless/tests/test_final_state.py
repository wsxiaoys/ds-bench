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
    tmp = tempfile.mkdtemp(prefix="gdx-replay-")
    try:
        yield tmp
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def _write_fixture(directory: str, name: str, content: str) -> str:
    path = os.path.join(directory, name)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(content)
    return path


def _run_launcher(input_path: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [LAUNCHER, f"--input={input_path}"],
        capture_output=True,
        text=True,
        timeout=RUN_TIMEOUT,
    )


def test_empty_replay_produces_origin(fixtures_dir):
    path = _write_fixture(fixtures_dir, "empty.txt", "")
    result = _run_launcher(path)

    assert result.returncode == 0, (
        "Launcher exited non-zero on empty input.\n"
        f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )
    assert "Final position: (0, 0)" in result.stdout, (
        "Empty replay should leave the walker at the origin and print "
        f"`Final position: (0, 0)`, but got stdout:\n{result.stdout}"
    )


def test_comments_and_blank_lines_are_skipped(fixtures_dir):
    content = (
        "# leading comment\n"
        "\n"
        "UP\n"
        "# mid comment\n"
        "\n"
        "RIGHT\n"
    )
    path = _write_fixture(fixtures_dir, "comments.txt", content)
    result = _run_launcher(path)

    assert result.returncode == 0, (
        "Launcher exited non-zero on a replay containing only valid keys, comments, and blank lines.\n"
        f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )
    assert "Final position: (1, 1)" in result.stdout, (
        "Replay containing one UP and one RIGHT (with comments and blank lines) "
        "should yield `Final position: (1, 1)`, but got stdout:\n"
        f"{result.stdout}"
    )


def test_all_four_directions_case_insensitive(fixtures_dir):
    content = "right\nRIGHT\nUp\nLEFT\ndown\n"
    path = _write_fixture(fixtures_dir, "mixed.txt", content)
    result = _run_launcher(path)

    assert result.returncode == 0, (
        "Launcher exited non-zero on a valid mixed-case replay.\n"
        f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )
    # right + right + up + left + down -> (2 - 1, 1 - 1) = (1, 0)
    assert "Final position: (1, 0)" in result.stdout, (
        "Mixed-case replay `right, RIGHT, Up, LEFT, down` should yield "
        f"`Final position: (1, 0)`, but got stdout:\n{result.stdout}"
    )


def test_long_sequence_with_negative_coordinates(fixtures_dir):
    content = "LEFT\nLEFT\nLEFT\nDOWN\nDOWN\nRIGHT\n"
    path = _write_fixture(fixtures_dir, "negative.txt", content)
    result = _run_launcher(path)

    assert result.returncode == 0, (
        "Launcher exited non-zero on a valid replay producing negative coordinates.\n"
        f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )
    # 3*LEFT + 1*RIGHT -> x = -2; 2*DOWN -> y = -2
    assert "Final position: (-2, -2)" in result.stdout, (
        "Replay `LEFT,LEFT,LEFT,DOWN,DOWN,RIGHT` should yield "
        f"`Final position: (-2, -2)`, but got stdout:\n{result.stdout}"
    )


def test_unknown_key_triggers_error(fixtures_dir):
    content = "UP\nJUMP\nLEFT\n"
    path = _write_fixture(fixtures_dir, "bad.txt", content)
    result = _run_launcher(path)

    assert result.returncode != 0, (
        "Launcher must exit with a non-zero status code when the replay file "
        "contains an unknown key. Got exit code 0.\n"
        f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )
    assert "Error: unknown key JUMP" in result.stderr, (
        "Launcher must report unknown keystrokes on stderr in the format "
        "`Error: unknown key <token>`. Got stderr:\n"
        f"{result.stderr}"
    )
    assert "Final position:" not in result.stdout, (
        "Launcher must not print a `Final position:` line when the replay fails. "
        f"Got stdout:\n{result.stdout}"
    )
