import shutil
import subprocess


def test_java_available():
    java = shutil.which("java")
    assert java is not None, "java runtime not found in PATH; a JDK is required to build/run the libGDX headless app."


def test_javac_available():
    javac = shutil.which("javac")
    assert javac is not None, "javac (JDK compiler) not found in PATH; a JDK is required to compile the project."


def test_gradle_available():
    gradle = shutil.which("gradle")
    assert gradle is not None, "gradle not found in PATH; Gradle is required to build the libGDX project."


def test_gradle_runs():
    gradle = shutil.which("gradle")
    assert gradle is not None, "gradle not found in PATH."
    result = subprocess.run(
        [gradle, "--version"],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"`gradle --version` failed with code {result.returncode}. "
        f"stdout={result.stdout!r} stderr={result.stderr!r}"
    )
    assert "Gradle" in result.stdout, f"Unexpected `gradle --version` output: {result.stdout!r}"
