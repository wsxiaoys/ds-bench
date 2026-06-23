import os
import shutil
import subprocess


PROJECT_DIR = "/home/user/pixmap-renderer"
GRADLE_CACHE = "/home/user/.gradle/caches/modules-2/files-2.1/com.badlogicgames.gdx"


def test_java_available():
    assert shutil.which("java") is not None, "java binary not found in PATH."


def test_gradle_available():
    assert shutil.which("gradle") is not None, "gradle binary not found in PATH."


def test_java_version_at_least_17():
    result = subprocess.run(
        ["java", "-version"], check=False, capture_output=True, text=True
    )
    # `java -version` prints the version banner on stderr.
    banner = (result.stderr or "") + (result.stdout or "")
    assert banner, "java -version produced no output."
    # Accept any 17+, 21+ style banner.
    assert (
        '"17' in banner
        or '"18' in banner
        or '"19' in banner
        or '"20' in banner
        or '"21' in banner
        or '"22' in banner
        or '"23' in banner
        or '"24' in banner
    ), f"Unexpected Java version banner: {banner.strip()}"


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} must exist before the task starts."
    )


def test_gradle_cache_has_gdx_core():
    gdx_dir = os.path.join(GRADLE_CACHE, "gdx", "1.14.2")
    assert os.path.isdir(gdx_dir), (
        f"libGDX core dependency must be pre-cached under {gdx_dir}."
    )
    jars = [name for name in _walk_files(gdx_dir) if name.endswith(".jar")]
    assert jars, f"No gdx-1.14.2.jar found in the offline Gradle cache at {gdx_dir}."


def test_gradle_cache_has_gdx_backend_headless():
    headless_dir = os.path.join(GRADLE_CACHE, "gdx-backend-headless", "1.14.2")
    assert os.path.isdir(headless_dir), (
        f"libGDX headless backend dependency must be pre-cached under {headless_dir}."
    )
    jars = [
        name for name in _walk_files(headless_dir) if name.endswith(".jar")
    ]
    assert jars, (
        f"No gdx-backend-headless-1.14.2.jar found in the offline Gradle cache at {headless_dir}."
    )


def test_gradle_cache_has_gdx_platform_natives_desktop():
    platform_dir = os.path.join(GRADLE_CACHE, "gdx-platform", "1.14.2")
    assert os.path.isdir(platform_dir), (
        f"libGDX desktop natives must be pre-cached under {platform_dir}."
    )
    jars = [name for name in _walk_files(platform_dir) if name.endswith(".jar")]
    has_natives = any("natives-desktop" in jar for jar in jars)
    assert has_natives, (
        "No gdx-platform-1.14.2-natives-desktop.jar found in the offline Gradle cache; "
        f"jars seen: {jars}"
    )


def _walk_files(root: str):
    for dirpath, _dirnames, filenames in os.walk(root):
        for filename in filenames:
            yield os.path.join(dirpath, filename)
