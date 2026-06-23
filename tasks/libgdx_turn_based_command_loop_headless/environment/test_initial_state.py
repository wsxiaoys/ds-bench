import os
import shutil
import subprocess


PROJECT_DIR = "/home/user/turn-based-game"


def test_java_is_available() -> None:
    java_path = shutil.which("java")
    assert java_path is not None, "java binary not found in PATH."


def test_javac_is_available() -> None:
    javac_path = shutil.which("javac")
    assert javac_path is not None, "javac binary not found in PATH."


def test_java_version_at_least_11() -> None:
    result = subprocess.run(
        ["java", "-version"],
        check=False,
        capture_output=True,
        text=True,
    )
    # `java -version` writes the version to stderr.
    output = (result.stderr or "") + (result.stdout or "")
    assert "version" in output, f"Unexpected java -version output: {output!r}"


def test_gradle_is_available() -> None:
    gradle_path = shutil.which("gradle")
    assert gradle_path is not None, "gradle binary not found in PATH."


def test_project_directory_exists() -> None:
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )


def test_project_directory_is_writable() -> None:
    assert os.access(PROJECT_DIR, os.W_OK), (
        f"Project directory {PROJECT_DIR} is not writable."
    )
