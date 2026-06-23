import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/myproject"


def test_java_available():
    assert shutil.which("java") is not None, "Java runtime (java) not found in PATH."


def test_javac_available():
    assert shutil.which("javac") is not None, "Java compiler (javac) not found in PATH."


def test_gradle_available():
    # Either a system gradle install or a project gradle wrapper is sufficient.
    system_gradle = shutil.which("gradle")
    wrapper = os.path.join(PROJECT_DIR, "gradlew")
    assert system_gradle is not None or os.path.isfile(wrapper), (
        "Neither system 'gradle' nor a project ./gradlew wrapper was found. "
        "A Gradle launcher is required to build the libGDX headless project."
    )


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist. The libGDX headless "
        "project must live under /home/user/myproject."
    )


def test_user_home_exists():
    assert os.path.isdir("/home/user"), "/home/user must exist as the workspace home."


def test_gradle_version_runs():
    # Sanity check that gradle (system or wrapper) can at least print its version.
    gradle_bin = shutil.which("gradle")
    if gradle_bin is None:
        wrapper = os.path.join(PROJECT_DIR, "gradlew")
        if not os.path.isfile(wrapper):
            return  # No launcher; previous test already failed.
        gradle_bin = wrapper
    result = subprocess.run(
        [gradle_bin, "--version"],
        cwd=PROJECT_DIR if gradle_bin.endswith("gradlew") else None,
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert result.returncode == 0, (
        f"Failed to run '{gradle_bin} --version'. stderr: {result.stderr}"
    )
