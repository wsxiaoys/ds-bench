import os
import shutil

PROJECT_DIR = "/home/user/quadtree-broadphase"


def test_java_runtime_available():
    assert shutil.which("java") is not None, "java runtime not found in PATH (JDK required for libGDX)."


def test_java_compiler_available():
    assert shutil.which("javac") is not None, "javac compiler not found in PATH (JDK required to build the Gradle project)."


def test_gradle_available():
    assert shutil.which("gradle") is not None, "gradle not found in PATH (needed to bootstrap the Gradle wrapper)."


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."
