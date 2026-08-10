import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/scene-baker"


def test_java_available():
    java = shutil.which("java")
    assert java is not None, "java runtime not found in PATH; a JDK is required to build/run the libGDX app."
    result = subprocess.run([java, "-version"], capture_output=True, text=True)
    assert result.returncode == 0, f"`java -version` failed: {result.stderr}"


def test_javac_available():
    assert shutil.which("javac") is not None, "javac (JDK compiler) not found in PATH; a full JDK is required."


def test_gradle_available():
    gradle = shutil.which("gradle")
    assert gradle is not None, "gradle not found in PATH; Gradle is required to build the libGDX headless module."
    result = subprocess.run([gradle, "--version"], capture_output=True, text=True)
    assert result.returncode == 0, f"`gradle --version` failed: {result.stderr}"


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."
