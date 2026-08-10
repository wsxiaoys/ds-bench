import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/project"


def test_java_available():
    java = shutil.which("java")
    assert java is not None, "java binary not found in PATH; a JDK is required."
    result = subprocess.run(
        ["java", "-version"],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"'java -version' failed with code {result.returncode}: {result.stderr}"
    )


def test_gradle_available():
    gradle = shutil.which("gradle")
    assert gradle is not None, "gradle binary not found in PATH; Gradle is required."


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )
