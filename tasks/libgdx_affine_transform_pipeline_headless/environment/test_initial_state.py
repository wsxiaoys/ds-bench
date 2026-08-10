import os
import shutil

PROJECT_DIR = "/home/user/affine-pipeline"


def test_gradle_available():
    assert shutil.which("gradle") is not None, "gradle binary not found in PATH."


def test_java_available():
    assert shutil.which("java") is not None, "java binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_settings_gradle_exists():
    settings_path = os.path.join(PROJECT_DIR, "settings.gradle")
    assert os.path.isfile(settings_path), f"{settings_path} does not exist."


def test_build_gradle_exists():
    build_path = os.path.join(PROJECT_DIR, "build.gradle")
    assert os.path.isfile(build_path), f"{build_path} does not exist."


def test_build_gradle_declares_libgdx_1_14_2():
    build_path = os.path.join(PROJECT_DIR, "build.gradle")
    with open(build_path) as f:
        content = f.read()
    assert "1.14.2" in content, "build.gradle does not pin libGDX version 1.14.2."
    assert "com.badlogicgames.gdx:gdx" in content, \
        "build.gradle does not declare the libGDX core dependency."
    assert "gdx-backend-headless" in content, \
        "build.gradle does not declare the libGDX headless backend dependency."


def test_build_gradle_configures_application_main_class():
    build_path = os.path.join(PROJECT_DIR, "build.gradle")
    with open(build_path) as f:
        content = f.read()
    assert "application" in content, "build.gradle does not apply the application plugin."
    assert "com.example.affine.HeadlessLauncher" in content, \
        "build.gradle does not set the main class to com.example.affine.HeadlessLauncher."
