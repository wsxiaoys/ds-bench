import os
import shutil

# Candidate roots where an offline dependency cache for libGDX may live.
CACHE_ROOTS = [
    "/opt/gdx-maven",
    "/root/.gradle",
    "/home/user/.gradle",
    "/root/.m2",
    "/home/user/.m2",
    "/opt/gradle-cache",
]


def _find_file(name_substrings):
    """Return the first file whose name contains all given substrings, searching the cache roots."""
    for root in CACHE_ROOTS:
        if not os.path.isdir(root):
            continue
        for dirpath, _dirnames, filenames in os.walk(root):
            for fn in filenames:
                if all(s in fn for s in name_substrings):
                    return os.path.join(dirpath, fn)
    return None


def test_java_runtime_available():
    assert shutil.which("java") is not None, "A Java runtime ('java') was not found in PATH."


def test_java_compiler_available():
    assert shutil.which("javac") is not None, "A Java compiler ('javac') was not found in PATH."


def test_gradle_build_tool_available():
    assert shutil.which("gradle") is not None, "The Gradle build tool ('gradle') was not found in PATH."


def test_home_directory_exists():
    assert os.path.isdir("/home/user"), "The home directory /home/user does not exist."


def test_libgdx_core_dependency_cached():
    hit = _find_file(["gdx-", "1.14.2", ".jar"])
    assert hit is not None, (
        "Could not find a cached libGDX 1.14.2 jar in any known offline cache location; "
        "the offline dependency cache appears to be missing."
    )


def test_libgdx_headless_backend_dependency_cached():
    hit = _find_file(["gdx-backend-headless", "1.14.2", ".jar"])
    assert hit is not None, (
        "Could not find a cached libGDX headless backend jar (gdx-backend-headless 1.14.2); "
        "the offline dependency cache appears to be incomplete."
    )


def test_libgdx_desktop_natives_cached():
    hit = _find_file(["gdx-platform", "1.14.2", "natives-desktop", ".jar"])
    assert hit is not None, (
        "Could not find the cached libGDX desktop natives jar "
        "(gdx-platform 1.14.2 natives-desktop); the offline dependency cache appears to be incomplete."
    )
