import os
import shutil
import subprocess


PROJECT_DIR = "/home/user/gdx-game"


def test_java_binary_available():
    assert shutil.which("java") is not None, (
        "`java` binary not found in PATH; libGDX requires a JDK to build and run."
    )


def test_javac_binary_available():
    assert shutil.which("javac") is not None, (
        "`javac` binary not found in PATH; a JDK (not just a JRE) is required to build libGDX projects."
    )


def test_java_version_is_17_or_higher():
    result = subprocess.run(
        ["java", "-version"], capture_output=True, text=True, check=False
    )
    # `java -version` writes to stderr historically.
    output = (result.stderr or "") + (result.stdout or "")
    assert output, "Failed to read `java -version` output."

    # Parse a version string like `"17.0.10"` or `"1.8.0_392"`.
    first_line = output.splitlines()[0]
    start = first_line.find('"')
    end = first_line.find('"', start + 1)
    assert start != -1 and end != -1, (
        f"Unexpected `java -version` output: {first_line!r}"
    )
    version_token = first_line[start + 1 : end]
    major_str = version_token.split(".")[0]
    try:
        major = int(major_str)
    except ValueError as exc:  # pragma: no cover - defensive
        raise AssertionError(
            f"Unable to parse major Java version from {version_token!r}: {exc}"
        ) from exc

    # Java 9+ uses single-digit major versions; legacy `1.8.x` uses `1` as the first token.
    if major == 1:
        legacy_major = int(version_token.split(".")[1])
        major = legacy_major

    assert major >= 17, (
        f"Java {major} detected; this task expects JDK 17 or newer for libGDX 1.14.2."
    )


def test_gradle_binary_available():
    assert shutil.which("gradle") is not None, (
        "`gradle` binary not found in PATH; the task uses Gradle to build the libGDX project."
    )


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Expected project directory {PROJECT_DIR!r} to exist before the task starts."
    )
