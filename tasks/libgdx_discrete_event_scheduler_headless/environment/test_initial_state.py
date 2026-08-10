import os
import shutil

PROJECT_DIR = "/home/user/project"


def test_java_available():
    assert shutil.which("java") is not None, "java runtime not found in PATH."


def test_javac_available():
    assert shutil.which("javac") is not None, "javac compiler not found in PATH."


def test_gradle_available():
    assert shutil.which("gradle") is not None, "gradle not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."
