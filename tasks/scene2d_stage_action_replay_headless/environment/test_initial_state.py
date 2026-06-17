import os
import re
import shutil
import subprocess


HOME_DIR = "/home/user"


def test_home_directory_exists():
    assert os.path.isdir(HOME_DIR), f"Home directory {HOME_DIR} does not exist."


def test_java_binary_available():
    assert shutil.which("java") is not None, "java binary not found in PATH."


def test_javac_binary_available():
    assert shutil.which("javac") is not None, "javac binary not found in PATH."


def test_gradle_binary_available():
    assert shutil.which("gradle") is not None, "gradle binary not found in PATH."


def test_java_version_is_at_least_17():
    # `java -version` writes to stderr.
    result = subprocess.run(
        ["java", "-version"],
        capture_output=True,
        text=True,
        check=True,
    )
    output = (result.stderr or "") + (result.stdout or "")
    match = re.search(r'version "?(\d+)', output)
    assert match is not None, (
        f"Could not parse java version from output: {output!r}"
    )
    major = int(match.group(1))
    assert major >= 17, (
        f"Expected Java >= 17 for the libGDX 1.14.x toolchain, got major version {major}."
    )


def test_gradle_runs_and_reports_version():
    result = subprocess.run(
        ["gradle", "--version"],
        capture_output=True,
        text=True,
        check=True,
        timeout=120,
    )
    combined = (result.stdout or "") + (result.stderr or "")
    assert "Gradle" in combined, (
        f"`gradle --version` did not report a Gradle version. Output: {combined!r}"
    )
