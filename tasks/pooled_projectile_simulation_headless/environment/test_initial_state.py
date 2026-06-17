import os
import shutil
import subprocess

HOME_DIR = "/home/user"
PROJECT_DIR = "/home/user/projectile_sim"
GRADLE_USER_HOME = "/home/user/.gradle"


def test_java_binary_available():
    assert shutil.which("java") is not None, "java binary not found in PATH."


def test_javac_binary_available():
    assert shutil.which("javac") is not None, "javac binary not found in PATH."


def test_gradle_binary_available():
    assert shutil.which("gradle") is not None, "gradle binary not found in PATH."


def test_java_version_is_at_least_17():
    result = subprocess.run(
        ["java", "-version"],
        capture_output=True,
        text=True,
        check=False,
    )
    combined = (result.stdout or "") + (result.stderr or "")
    assert combined.strip() != "", "java -version produced no output."
    # OpenJDK version strings look like: openjdk version "17.0.10" or "21.0.2"
    # Accept anything >= 17.
    found_version = False
    for token in combined.replace('"', " ").split():
        if not token or "." not in token:
            continue
        major_str = token.split(".", 1)[0]
        if major_str.isdigit():
            major = int(major_str)
            if major >= 17:
                found_version = True
                break
    assert found_version, f"Expected Java >= 17, got version output: {combined.strip()}"


def test_gradle_version_runs():
    result = subprocess.run(
        ["gradle", "--version"],
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, f"gradle --version failed: {result.stderr}"
    assert "Gradle" in result.stdout, "gradle --version did not report a Gradle release."


def test_home_directory_exists():
    assert os.path.isdir(HOME_DIR), f"Home directory {HOME_DIR} does not exist."


def test_project_directory_is_clean():
    # The executor is responsible for creating the project. The directory should
    # either not exist yet, or exist but be empty (so the executor has full control).
    if os.path.exists(PROJECT_DIR):
        assert os.path.isdir(PROJECT_DIR), (
            f"{PROJECT_DIR} exists but is not a directory."
        )
        entries = os.listdir(PROJECT_DIR)
        assert entries == [], (
            f"Project directory {PROJECT_DIR} is not empty before the task starts; "
            f"found entries: {entries}"
        )


def test_gradle_cache_has_libgdx_core():
    # The Docker image pre-fetches libGDX 1.14.2 dependencies into the Gradle
    # cache so the executor can build without internet access. Verify the core
    # libGDX jar is present somewhere under the Gradle user home cache.
    cache_root = os.path.join(
        GRADLE_USER_HOME, "caches", "modules-2", "files-2.1",
        "com.badlogicgames.gdx", "gdx", "1.14.2",
    )
    assert os.path.isdir(cache_root), (
        f"libGDX 1.14.2 was not pre-fetched into the Gradle cache at {cache_root}."
    )
    has_jar = False
    for dirpath, _dirnames, filenames in os.walk(cache_root):
        for name in filenames:
            if name == "gdx-1.14.2.jar":
                has_jar = True
                break
        if has_jar:
            break
    assert has_jar, (
        f"gdx-1.14.2.jar not found in the Gradle cache under {cache_root}."
    )


def test_gradle_cache_has_libgdx_headless_backend():
    cache_root = os.path.join(
        GRADLE_USER_HOME, "caches", "modules-2", "files-2.1",
        "com.badlogicgames.gdx", "gdx-backend-headless", "1.14.2",
    )
    assert os.path.isdir(cache_root), (
        f"libGDX headless backend was not pre-fetched into the Gradle cache at {cache_root}."
    )
    has_jar = False
    for dirpath, _dirnames, filenames in os.walk(cache_root):
        for name in filenames:
            if name == "gdx-backend-headless-1.14.2.jar":
                has_jar = True
                break
        if has_jar:
            break
    assert has_jar, (
        "gdx-backend-headless-1.14.2.jar not found in the Gradle cache."
    )
