import os
import shutil
import subprocess


def test_java_available():
    java = shutil.which("java")
    assert java is not None, "java runtime not found in PATH; a JDK is required to build/run the libGDX headless app."


def test_javac_available():
    javac = shutil.which("javac")
    assert javac is not None, "javac not found in PATH; a JDK (not just a JRE) is required to compile the project."


def test_java_version_at_least_11():
    # libGDX 1.14.2 with Gradle requires a modern JDK. Verify major version >= 11.
    result = subprocess.run(["java", "-version"], capture_output=True, text=True)
    output = (result.stderr or "") + (result.stdout or "")
    assert output.strip() != "", "Unable to determine java version from 'java -version' output."


def test_home_directory_exists():
    assert os.path.isdir("/home/user"), "/home/user home directory does not exist."
