import os
import shutil
import subprocess


PROJECT_DIR = "/home/user/myproject"


def test_godot_binary_available():
    assert shutil.which("godot") is not None, "godot binary not found in PATH."


def test_godot_headless_runs():
    result = subprocess.run(
        ["godot", "--headless", "--version"],
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 0, (
        f"`godot --headless --version` failed (rc={result.returncode}): "
        f"stdout={result.stdout!r} stderr={result.stderr!r}"
    )
    assert result.stdout.strip().startswith("4."), (
        f"Expected Godot 4.x version, got: {result.stdout!r}"
    )


def test_scons_available():
    assert shutil.which("scons") is not None, "scons build tool not found in PATH."


def test_cpp_compiler_available():
    assert shutil.which("g++") is not None, "g++ compiler not found in PATH."


def test_python3_available():
    assert shutil.which("python3") is not None, "python3 not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_project_godot_file_exists():
    project_file = os.path.join(PROJECT_DIR, "project.godot")
    assert os.path.isfile(project_file), (
        f"project.godot file is missing at {project_file}."
    )


def test_godot_cpp_submodule_present():
    godot_cpp = os.path.join(PROJECT_DIR, "godot-cpp")
    assert os.path.isdir(godot_cpp), (
        f"godot-cpp source directory missing at {godot_cpp}."
    )
    sconstruct = os.path.join(godot_cpp, "SConstruct")
    assert os.path.isfile(sconstruct), (
        f"godot-cpp/SConstruct is missing at {sconstruct}; the godot-cpp checkout looks incomplete."
    )
    include_dir = os.path.join(godot_cpp, "include", "godot_cpp")
    assert os.path.isdir(include_dir), (
        f"godot-cpp headers missing at {include_dir}."
    )
