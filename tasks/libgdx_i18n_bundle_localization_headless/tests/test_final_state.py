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
    tmp = tempfile.mkdtemp(prefix="gdx-i18n-")
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


def _stdout_payload_lines(stdout: str) -> list[str]:
    """Return the non-empty stdout lines (stripped of trailing newlines)."""
    return [line for line in stdout.splitlines() if line.strip() != ""]


def test_empty_command_file_produces_no_output(fixtures_dir):
    path = _write_fixture(fixtures_dir, "empty.txt", "")
    result = _run_launcher(path)

    assert result.returncode == 0, (
        "Launcher exited non-zero on an empty command file.\n"
        f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )
    assert _stdout_payload_lines(result.stdout) == [], (
        "An empty command file must produce no stdout output, but got:\n"
        f"{result.stdout}"
    )


def test_english_base_bundle_lookups(fixtures_dir):
    content = (
        "# English smoke test\n"
        "LOCALE en\n"
        "GET greeting\n"
        "GET farewell\n"
        "FORMAT welcomeUser Alice\n"
        "FORMAT scoreReport Bob 42\n"
    )
    path = _write_fixture(fixtures_dir, "english.txt", content)
    result = _run_launcher(path)

    assert result.returncode == 0, (
        "Launcher exited non-zero on a valid English command file.\n"
        f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )
    expected = [
        "greeting=Hello",
        "farewell=Goodbye",
        "welcomeUser=Welcome, Alice!",
        "scoreReport=Player Bob scored 42 points",
    ]
    assert _stdout_payload_lines(result.stdout) == expected, (
        "English run should emit exactly the expected key=value lines in order.\n"
        f"expected:\n{expected}\nactual stdout:\n{result.stdout}"
    )


def test_french_lookups_with_base_fallback(fixtures_dir):
    content = (
        "LOCALE fr\n"
        "GET greeting\n"
        "GET farewell\n"
        "FORMAT welcomeUser Alice\n"
        "GET gameName\n"
    )
    path = _write_fixture(fixtures_dir, "french.txt", content)
    result = _run_launcher(path)

    assert result.returncode == 0, (
        "Launcher exited non-zero on a valid French command file.\n"
        f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )
    expected = [
        "greeting=Bonjour",
        "farewell=Au revoir",
        "welcomeUser=Bienvenue, Alice !",
        "gameName=Cosmic Quest",
    ]
    assert _stdout_payload_lines(result.stdout) == expected, (
        "French run should emit the localized lines and fall back to the base "
        "bundle for `gameName`.\n"
        f"expected:\n{expected}\nactual stdout:\n{result.stdout}"
    )


def test_locale_switching_within_one_run(fixtures_dir):
    content = (
        "LOCALE de\n"
        "GET greeting\n"
        "FORMAT scoreReport Carol 7\n"
        "LOCALE fr\n"
        "GET farewell\n"
        "LOCALE en\n"
        "GET gameName\n"
    )
    path = _write_fixture(fixtures_dir, "mixed.txt", content)
    result = _run_launcher(path)

    assert result.returncode == 0, (
        "Launcher exited non-zero on a valid multi-locale command file.\n"
        f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )
    expected = [
        "greeting=Hallo",
        "scoreReport=Spieler Carol hat 7 Punkte erzielt",
        "farewell=Au revoir",
        "gameName=Cosmic Quest",
    ]
    assert _stdout_payload_lines(result.stdout) == expected, (
        "Switching locales mid-run should produce the correct localized lines "
        "in the order the commands were issued.\n"
        f"expected:\n{expected}\nactual stdout:\n{result.stdout}"
    )


def test_lookup_before_locale_errors(fixtures_dir):
    content = "GET greeting\n"
    path = _write_fixture(fixtures_dir, "no_locale.txt", content)
    result = _run_launcher(path)

    assert result.returncode != 0, (
        "Launcher must exit non-zero when a lookup is issued before any LOCALE.\n"
        f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )
    assert "Error: no locale selected" in result.stderr, (
        "Launcher must report `Error: no locale selected` on stderr when "
        "a GET/FORMAT is issued before any LOCALE.\n"
        f"stderr:\n{result.stderr}"
    )
    assert not any(line.startswith("greeting=") for line in result.stdout.splitlines()), (
        "Launcher must not emit a `greeting=...` line when the lookup fails "
        "before any LOCALE has been set.\n"
        f"stdout:\n{result.stdout}"
    )


def test_unsupported_locale_errors(fixtures_dir):
    content = "LOCALE jp\nGET greeting\n"
    path = _write_fixture(fixtures_dir, "bad_locale.txt", content)
    result = _run_launcher(path)

    assert result.returncode != 0, (
        "Launcher must exit non-zero when an unsupported locale code is used.\n"
        f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )
    assert "Error: unsupported locale jp" in result.stderr, (
        "Launcher must report `Error: unsupported locale jp` on stderr when "
        "an unsupported locale code is used.\n"
        f"stderr:\n{result.stderr}"
    )
    assert not any(line.startswith("greeting=") for line in result.stdout.splitlines()), (
        "Launcher must not emit a `greeting=...` line after an unsupported-locale "
        "error.\n"
        f"stdout:\n{result.stdout}"
    )


def test_missing_key_errors(fixtures_dir):
    content = "LOCALE fr\nGET greeting\nGET highScore\n"
    path = _write_fixture(fixtures_dir, "missing_key.txt", content)
    result = _run_launcher(path)

    assert result.returncode != 0, (
        "Launcher must exit non-zero when a missing key is requested.\n"
        f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )
    stdout_lines = result.stdout.splitlines()
    assert "greeting=Bonjour" in stdout_lines, (
        "Lookups issued before the missing key must still print their results.\n"
        f"stdout:\n{result.stdout}"
    )
    assert "Error: missing key highScore" in result.stderr, (
        "Launcher must report `Error: missing key highScore` on stderr when "
        "the key is absent from both the active locale and the base bundle.\n"
        f"stderr:\n{result.stderr}"
    )
    assert not any(line.startswith("highScore=") for line in stdout_lines), (
        "Launcher must not emit a `highScore=...` line for an unknown key.\n"
        f"stdout:\n{result.stdout}"
    )


def test_unknown_command_errors(fixtures_dir):
    content = "LOCALE en\nSHOUT greeting\n"
    path = _write_fixture(fixtures_dir, "unknown_command.txt", content)
    result = _run_launcher(path)

    assert result.returncode != 0, (
        "Launcher must exit non-zero when an unknown command keyword is used.\n"
        f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )
    assert "Error: unknown command SHOUT" in result.stderr, (
        "Launcher must report `Error: unknown command SHOUT` on stderr when "
        "an unknown command keyword is encountered.\n"
        f"stderr:\n{result.stderr}"
    )
    assert not any(line.startswith("greeting=") for line in result.stdout.splitlines()), (
        "Launcher must not emit a `greeting=...` line as a result of an unknown "
        "`SHOUT greeting` command.\n"
        f"stdout:\n{result.stdout}"
    )
