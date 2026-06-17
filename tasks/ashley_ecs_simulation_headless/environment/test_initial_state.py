import os
import shutil
import subprocess


PROJECT_DIR = "/home/user/gdx-ecs"


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} must exist before the task starts."
    )


def test_java_available():
    java = shutil.which("java")
    assert java is not None, "java binary not found in PATH (a JDK is required to build libGDX)."

    result = subprocess.run(
        [java, "-version"],
        capture_output=True,
        text=True,
        timeout=30,
    )
    # `java -version` writes its version banner to stderr.
    combined = (result.stdout or "") + (result.stderr or "")
    assert "version" in combined.lower(), (
        f"`java -version` did not report a version string. stdout={result.stdout!r} stderr={result.stderr!r}"
    )


def test_javac_available():
    javac = shutil.which("javac")
    assert javac is not None, "javac binary not found in PATH (a JDK is required to compile libGDX sources)."


def test_gradle_available():
    gradle = shutil.which("gradle")
    assert gradle is not None, "gradle binary not found in PATH (Gradle is required to build the libGDX project)."

    result = subprocess.run(
        [gradle, "--version"],
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 0, (
        f"`gradle --version` failed with exit code {result.returncode}. "
        f"stdout={result.stdout!r} stderr={result.stderr!r}"
    )
    assert "Gradle" in result.stdout, (
        f"`gradle --version` output did not contain 'Gradle'. stdout={result.stdout!r}"
    )
