import os
import subprocess

import pytest

PROJECT_DIR = "/home/user/combo-detector"
GRADLEW = os.path.join(PROJECT_DIR, "gradlew")

# ---------------------------------------------------------------------------
# Scripted input fixtures (exactly as defined in the task's verification plan).
# One tick per line; the tick index equals the 0-based line number.
# ---------------------------------------------------------------------------

CASE1_INPUT = "\n".join([
    "+DOWN",            # tick 0
    "+RIGHT",           # tick 1
    "-DOWN",            # tick 2
    "+PUNCH -RIGHT",    # tick 3  -> HADOKEN (motion 2,3,6)
    "+RIGHT",           # tick 4
    "-RIGHT",           # tick 5
    "+DOWN",            # tick 6
    "+RIGHT",           # tick 7
    "+PUNCH",           # tick 8  -> SHORYUKEN (motion 6,2,3)
    "-DOWN -RIGHT",     # tick 9
]) + "\n"

CASE1_EXPECTED = [
    "TICK 3 HADOKEN",
    "TICK 8 SHORYUKEN",
    "--- TALLY ---",
    "HADOKEN 1",
    "SHORYUKEN 1",
    "TATSU 0",
    "TOTAL 2",
]

CASE2_INPUT = "\n".join([
    "+PAUSE",           # tick 0  -> paused
    "+DOWN",            # tick 1  (swallowed)
    "+RIGHT",           # tick 2  (swallowed)
    "-DOWN",            # tick 3  (swallowed)
    "+PUNCH",           # tick 4  (swallowed -> NO hadoken)
    "-RIGHT",           # tick 5  (swallowed)
    "+PAUSE",           # tick 6  -> unpaused
    "+DOWN",            # tick 7  token (2,7)
    "+RIGHT",           # tick 8  token (3,8)
    "",                 # tick 9
    "",                 # tick 10
    "",                 # tick 11
    "",                 # tick 12
    "",                 # tick 13
    "",                 # tick 14
    "",                 # tick 15
    "",                 # tick 16
    "",                 # tick 17
    "",                 # tick 18
    "",                 # tick 19
    "-DOWN",            # tick 20 token (6,20)
    "+PUNCH -RIGHT",    # tick 21 PUNCH: 21-7=14>12 -> window expired, NO hadoken
    "+DOWN",            # tick 22 token (2,22)
    "+LEFT",            # tick 23 token (1,23)
    "-DOWN",            # tick 24 token (4,24)
    "+KICK -LEFT",      # tick 25 -> TATSU (motion 2,1,4)
]) + "\n"

CASE2_EXPECTED = [
    "TICK 25 TATSU",
    "--- TALLY ---",
    "HADOKEN 0",
    "SHORYUKEN 0",
    "TATSU 1",
    "TOTAL 1",
]


def _normalize(text):
    """Split into lines, drop trailing whitespace per line, and drop trailing
    blank lines (a trailing newline at EOF is allowed by the spec)."""
    lines = [ln.rstrip("\r") for ln in text.split("\n")]
    while lines and lines[-1].strip() == "":
        lines.pop()
    return [ln.rstrip() for ln in lines]


@pytest.fixture(scope="session")
def built_project():
    """Compile the runnable headless module once before running the scenarios."""
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."
    assert os.path.isfile(GRADLEW), f"Gradle wrapper not found at {GRADLEW}."
    os.chmod(GRADLEW, 0o755)
    result = subprocess.run(
        ["./gradlew", "--no-daemon", "headless:build", "-x", "test"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=900,
    )
    print("=== headless:build stdout ===")
    print(result.stdout[-8000:])
    print("=== headless:build stderr ===")
    print(result.stderr[-8000:])
    assert result.returncode == 0, (
        f"Building the 'headless' module failed (exit {result.returncode}). See logs above."
    )
    return True


def _run_case(name, input_text):
    input_path = os.path.join(PROJECT_DIR, f"{name}.txt")
    output_path = os.path.join(PROJECT_DIR, f"{name}_out.txt")
    with open(input_path, "w", encoding="utf-8") as f:
        f.write(input_text)
    if os.path.exists(output_path):
        os.remove(output_path)

    result = subprocess.run(
        ["./gradlew", "--no-daemon", "headless:run", f"--args={input_path} {output_path}"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=600,
    )
    print(f"=== {name} run stdout ===")
    print(result.stdout[-8000:])
    print(f"=== {name} run stderr ===")
    print(result.stderr[-8000:])
    assert result.returncode == 0, (
        f"Running scenario '{name}' via headless:run failed (exit {result.returncode}). See logs above."
    )
    assert os.path.isfile(output_path), (
        f"Expected output file {output_path} was not created by scenario '{name}'."
    )
    with open(output_path, "r", encoding="utf-8") as f:
        return _normalize(f.read())


def test_happy_path_hadoken_then_shoryuken(built_project):
    """A DOWN,DOWN-FORWARD,FORWARD+PUNCH fireball then a FORWARD,DOWN,DOWN-FORWARD+PUNCH
    dragon punch must both be recognized at the correct ticks with a correct tally."""
    actual = _run_case("case1", CASE1_INPUT)
    assert actual == CASE1_EXPECTED, (
        f"Combo log/tally mismatch for happy path.\nExpected:\n{CASE1_EXPECTED}\nActual:\n{actual}"
    )


def test_pause_swallow_window_expiry_and_valid_tatsu(built_project):
    """Pause must swallow a full fireball motion (no HADOKEN), a too-slow motion must
    expire the window (no HADOKEN), and a valid DOWN,DOWN-BACK,BACK+KICK must yield one TATSU."""
    actual = _run_case("case2", CASE2_INPUT)
    assert actual == CASE2_EXPECTED, (
        f"Combo log/tally mismatch for pause/window/tatsu scenario.\nExpected:\n{CASE2_EXPECTED}\nActual:\n{actual}"
    )


def test_multiplexer_consumption_invariant(built_project):
    """The PauseProcessor sits ahead of the ComboProcessor; while paused it must consume
    events so the ComboProcessor never sees the fireball performed at ticks 1-5. Therefore
    no PUNCH combo may ever appear in scenario 2's output."""
    actual = _run_case("case2", CASE2_INPUT)
    combo_lines = [ln for ln in actual if ln.startswith("TICK ")]
    assert all("HADOKEN" not in ln and "SHORYUKEN" not in ln for ln in combo_lines), (
        "A PUNCH combo was recognized in scenario 2, which means paused input was not "
        f"consumed by the PauseProcessor before reaching the ComboProcessor. Combo lines: {combo_lines}"
    )
    assert "HADOKEN 0" in actual and "SHORYUKEN 0" in actual, (
        f"Expected zero HADOKEN and SHORYUKEN in the tally for scenario 2, got: {actual}"
    )


def test_tally_consistency_with_combo_lines(built_project):
    """The tally counts and TOTAL must equal the number of TICK lines per combo."""
    actual = _run_case("case1", CASE1_INPUT)
    combo_lines = [ln for ln in actual if ln.startswith("TICK ")]
    counts = {"HADOKEN": 0, "SHORYUKEN": 0, "TATSU": 0}
    for ln in combo_lines:
        for name in counts:
            if ln.endswith(" " + name):
                counts[name] += 1
    for name, expected in counts.items():
        assert f"{name} {expected}" in actual, (
            f"Tally for {name} should be {expected} based on {len(combo_lines)} TICK lines, output: {actual}"
        )
    assert f"TOTAL {len(combo_lines)}" in actual, (
        f"TOTAL should equal the number of TICK lines ({len(combo_lines)}), output: {actual}"
    )
