import os
import glob
import shutil
import subprocess

PROJECT_DIR = "/home/user/gdx-astar"
HOME = "/home/user"


def test_java_available():
    java = shutil.which("java")
    assert java is not None, "java executable not found in PATH; a JDK is required to build the libGDX headless app."
    result = subprocess.run([java, "-version"], capture_output=True, text=True)
    assert result.returncode == 0, f"`java -version` failed: {result.stderr}"


def test_gradle_available():
    gradle = shutil.which("gradle")
    assert gradle is not None, "gradle executable not found in PATH; Gradle is required to build the project."
    result = subprocess.run([gradle, "--version"], capture_output=True, text=True)
    assert result.returncode == 0, f"`gradle --version` failed: {result.stderr}"
    assert "8.10" in result.stdout, f"Expected Gradle 8.10 to be installed, got:\n{result.stdout}"


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project working directory {PROJECT_DIR} does not exist."


def test_libgdx_headless_artifact_cached():
    # The libGDX 1.14.2 artifacts must be pre-populated in the local caches so the
    # project can be built offline at test time.
    patterns = [
        os.path.join(HOME, ".gradle", "caches", "**", "gdx-backend-headless-1.14.2.jar"),
        os.path.join(HOME, ".m2", "repository", "**", "gdx-backend-headless-1.14.2.jar"),
    ]
    found = []
    for pat in patterns:
        found.extend(glob.glob(pat, recursive=True))
    assert found, (
        "Could not find a cached gdx-backend-headless-1.14.2.jar under the local Gradle/Maven caches; "
        "the offline environment is not primed with the required libGDX headless artifact."
    )


def test_libgdx_core_artifact_cached():
    patterns = [
        os.path.join(HOME, ".gradle", "caches", "**", "gdx-1.14.2.jar"),
        os.path.join(HOME, ".m2", "repository", "**", "gdx-1.14.2.jar"),
    ]
    found = []
    for pat in patterns:
        found.extend(glob.glob(pat, recursive=True))
    assert found, (
        "Could not find a cached gdx-1.14.2.jar under the local Gradle/Maven caches; "
        "the offline environment is not primed with the required libGDX core artifact."
    )
