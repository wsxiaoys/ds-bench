import shutil
import subprocess


def test_java_runtime_available():
    assert shutil.which("java") is not None, "java runtime not found in PATH."


def test_java_compiler_available():
    assert shutil.which("javac") is not None, "javac (JDK compiler) not found in PATH."


def test_gradle_available():
    assert shutil.which("gradle") is not None, "gradle not found in PATH."


def test_java_is_java17_or_newer():
    # libGDX 1.14.2 tooling requires a modern JDK; verify a usable Java version.
    result = subprocess.run(
        ["java", "-version"], capture_output=True, text=True
    )
    output = (result.stderr or "") + (result.stdout or "")
    assert "version" in output.lower(), (
        f"Unable to determine Java version from 'java -version' output: {output!r}"
    )
