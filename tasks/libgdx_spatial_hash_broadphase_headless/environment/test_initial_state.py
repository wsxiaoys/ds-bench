import glob
import os
import shutil

PROJECT_DIR = "/home/user/project"
GRADLE_HOME = "/home/user/.gradle"


def test_java_runtime_available():
    assert shutil.which("java") is not None, "java runtime not found in PATH."


def test_java_compiler_available():
    assert shutil.which("javac") is not None, "javac (JDK) not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_gradle_wrapper_present():
    gradlew = os.path.join(PROJECT_DIR, "gradlew")
    assert os.path.isfile(gradlew), f"Gradle wrapper {gradlew} does not exist."
    assert os.access(gradlew, os.X_OK), f"Gradle wrapper {gradlew} is not executable."


def test_gradle_build_files_present():
    settings = os.path.join(PROJECT_DIR, "settings.gradle")
    build = os.path.join(PROJECT_DIR, "build.gradle")
    assert os.path.isfile(settings), f"settings.gradle not found at {settings}."
    assert os.path.isfile(build), f"build.gradle not found at {build}."


def test_libgdx_core_cached_offline():
    pattern = os.path.join(
        GRADLE_HOME, "caches", "**", "com.badlogicgames.gdx", "gdx", "1.14.2", "**", "*.jar"
    )
    matches = glob.glob(pattern, recursive=True)
    assert matches, (
        "libGDX core 1.14.2 jar was not found in the local Gradle cache; "
        "the environment must have dependencies cached for offline use."
    )


def test_libgdx_headless_backend_cached_offline():
    pattern = os.path.join(
        GRADLE_HOME,
        "caches",
        "**",
        "com.badlogicgames.gdx",
        "gdx-backend-headless",
        "1.14.2",
        "**",
        "*.jar",
    )
    matches = glob.glob(pattern, recursive=True)
    assert matches, (
        "libGDX headless backend 1.14.2 jar was not found in the local Gradle cache; "
        "the headless backend must be cached for offline use."
    )
