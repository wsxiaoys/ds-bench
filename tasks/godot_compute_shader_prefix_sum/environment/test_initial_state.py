import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/scan"
INPUT_FILE = os.path.join(PROJECT_DIR, "data", "input.txt")


def test_godot_binary_available():
    assert shutil.which("godot") is not None, "godot binary not found in PATH."


def test_godot_version_is_4_4():
    result = subprocess.run(
        ["godot", "--version"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        timeout=60,
    )
    output = result.stdout or ""
    assert "4.4" in output, f"Expected Godot 4.4.x, got version output: {output!r}"


def test_run_wrapper_available():
    assert shutil.which("godot-run") is not None, (
        "The 'godot-run' launcher wrapper was not found in PATH."
    )


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )


def test_input_fixture_exists():
    assert os.path.isfile(INPUT_FILE), (
        f"Input fixture {INPUT_FILE} does not exist."
    )


def test_input_fixture_is_well_formed():
    with open(INPUT_FILE) as f:
        tokens = f.read().split()
    assert len(tokens) >= 1, f"Input fixture {INPUT_FILE} is empty."
    try:
        n = int(tokens[0])
    except ValueError:
        raise AssertionError(
            f"First token of {INPUT_FILE} must be an integer count, got {tokens[0]!r}."
        )
    assert n > 0, f"Element count in {INPUT_FILE} must be positive, got {n}."
    values = tokens[1:]
    assert len(values) == n, (
        f"Input fixture {INPUT_FILE} declares {n} elements but contains {len(values)}."
    )
    for tok in values:
        try:
            v = int(tok)
        except ValueError:
            raise AssertionError(
                f"Non-integer value {tok!r} found in input fixture {INPUT_FILE}."
            )
        assert v >= 0, f"Input values must be non-negative; found {v}."
