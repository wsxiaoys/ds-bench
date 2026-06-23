import os
import shutil
import subprocess
import textwrap

import pytest


PROJECT_DIR = "/home/user/turn-based-game"


GRADLE_RUN_CMD_TEMPLATE = (
    './gradlew --no-daemon -q :headless:run '
    '--args="--map={map_path} --commands={cmds_path} --transcript={out_path}"'
)


def _write(path: str, content: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    # Strip the leading newline that comes from textwrap.dedent for readability.
    if content.startswith("\n"):
        content = content[1:]
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(content)


def _read_transcript(path: str) -> str:
    assert os.path.isfile(path), f"Expected transcript file at {path} but it is missing."
    with open(path, "r", encoding="utf-8") as fh:
        return fh.read()


def _run_case(
    case_name: str,
    map_content: str,
    cmds_content: str,
) -> str:
    map_path = f"/tmp/{case_name}_map.txt"
    cmds_path = f"/tmp/{case_name}_cmds.txt"
    out_path = f"/tmp/{case_name}_transcript.txt"

    _write(map_path, map_content)
    _write(cmds_path, cmds_content)

    if os.path.exists(out_path):
        os.remove(out_path)

    cmd = GRADLE_RUN_CMD_TEMPLATE.format(
        map_path=map_path,
        cmds_path=cmds_path,
        out_path=out_path,
    )

    result = subprocess.run(
        ["bash", "-lc", cmd],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=600,
    )

    assert result.returncode == 0, (
        f"Gradle run for case {case_name!r} failed with exit code "
        f"{result.returncode}.\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
    )

    transcript = _read_transcript(out_path)
    return transcript


def _normalize(text: str) -> list[str]:
    # Split on LF/CRLF, drop a single trailing empty line (the required terminal newline)
    # but keep blank lines in the middle (there should be none).
    lines = text.replace("\r\n", "\n").split("\n")
    if lines and lines[-1] == "":
        lines.pop()
    return lines


def test_project_dir_still_present() -> None:
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} should still exist after the task."
    )


def test_gradle_wrapper_present() -> None:
    gradlew = os.path.join(PROJECT_DIR, "gradlew")
    assert os.path.isfile(gradlew), (
        f"Gradle wrapper script not found at {gradlew}."
    )
    assert os.access(gradlew, os.X_OK), (
        f"Gradle wrapper script at {gradlew} is not executable."
    )


def test_settings_gradle_defines_headless_module() -> None:
    settings_path = os.path.join(PROJECT_DIR, "settings.gradle")
    settings_kts = os.path.join(PROJECT_DIR, "settings.gradle.kts")
    if os.path.isfile(settings_path):
        path = settings_path
    elif os.path.isfile(settings_kts):
        path = settings_kts
    else:
        pytest.fail(
            "Expected settings.gradle or settings.gradle.kts at the project root."
        )
    with open(path, "r", encoding="utf-8") as fh:
        content = fh.read()
    assert "headless" in content, (
        "settings.gradle(.kts) does not include the ':headless' module."
    )


def test_case_a_basic_movement_and_pickup() -> None:
    map_content = textwrap.dedent(
        """
        5 5
        1 1
        2
        2 1 gem
        3 2 key
        """
    )
    cmds_content = textwrap.dedent(
        """
        E
        PICK
        N
        E
        PICK
        """
    )
    transcript = _run_case("case_a", map_content, cmds_content)
    lines = _normalize(transcript)
    expected = [
        "turn=1 cmd=E pos=2,1 inv=",
        "turn=2 cmd=PICK pos=2,1 inv=gem",
        "turn=3 cmd=N pos=2,2 inv=gem",
        "turn=4 cmd=E pos=3,2 inv=gem",
        "turn=5 cmd=PICK pos=3,2 inv=gem,key",
        "FINAL pos=3,2 inv=gem,key turns=5",
    ]
    assert lines == expected, (
        "Case A transcript mismatch.\n"
        f"Expected:\n{chr(10).join(expected)}\n\nGot:\n{chr(10).join(lines)}"
    )


def test_case_b_quit_early_terminates() -> None:
    map_content = textwrap.dedent(
        """
        3 3
        0 0
        1
        1 0 coin
        """
    )
    cmds_content = textwrap.dedent(
        """
        E
        PICK
        QUIT
        N
        N
        """
    )
    transcript = _run_case("case_b", map_content, cmds_content)
    lines = _normalize(transcript)
    expected = [
        "turn=1 cmd=E pos=1,0 inv=",
        "turn=2 cmd=PICK pos=1,0 inv=coin",
        "turn=3 cmd=QUIT pos=1,0 inv=coin",
        "FINAL pos=1,0 inv=coin turns=3",
    ]
    assert lines == expected, (
        "Case B transcript mismatch (commands after QUIT must not appear).\n"
        f"Expected:\n{chr(10).join(expected)}\n\nGot:\n{chr(10).join(lines)}"
    )


def test_case_c_out_of_bounds_and_unknown_command() -> None:
    map_content = textwrap.dedent(
        """
        2 2
        0 0
        0
        """
    )
    cmds_content = textwrap.dedent(
        """
        W
        S
        DANCE
        N
        E
        E
        """
    )
    transcript = _run_case("case_c", map_content, cmds_content)
    lines = _normalize(transcript)
    expected = [
        "turn=1 cmd=W pos=0,0 inv=",
        "turn=2 cmd=S pos=0,0 inv=",
        "turn=3 cmd=DANCE pos=0,0 inv=",
        "turn=4 cmd=N pos=0,1 inv=",
        "turn=5 cmd=E pos=1,1 inv=",
        "turn=6 cmd=E pos=1,1 inv=",
        "FINAL pos=1,1 inv= turns=6",
    ]
    assert lines == expected, (
        "Case C transcript mismatch (out-of-bounds moves and unknown commands).\n"
        f"Expected:\n{chr(10).join(expected)}\n\nGot:\n{chr(10).join(lines)}"
    )


def test_case_d_comments_and_blank_lines_in_commands() -> None:
    map_content = textwrap.dedent(
        """
        4 4
        1 1
        1
        2 1 ruby
        """
    )
    cmds_content = textwrap.dedent(
        """
        # warm-up
        E

        # pick the ruby
        PICK

        N
        """
    )
    transcript = _run_case("case_d", map_content, cmds_content)
    lines = _normalize(transcript)
    expected = [
        "turn=1 cmd=E pos=2,1 inv=",
        "turn=2 cmd=PICK pos=2,1 inv=ruby",
        "turn=3 cmd=N pos=2,2 inv=ruby",
        "FINAL pos=2,2 inv=ruby turns=3",
    ]
    assert lines == expected, (
        "Case D transcript mismatch (comments and blanks must be ignored).\n"
        f"Expected:\n{chr(10).join(expected)}\n\nGot:\n{chr(10).join(lines)}"
    )


def test_transcript_has_trailing_newline() -> None:
    transcript_path = "/tmp/case_a_transcript.txt"
    # Re-run Case A in isolation so this test is independent.
    map_content = textwrap.dedent(
        """
        5 5
        1 1
        2
        2 1 gem
        3 2 key
        """
    )
    cmds_content = textwrap.dedent(
        """
        E
        PICK
        N
        E
        PICK
        """
    )
    _run_case("case_a", map_content, cmds_content)
    with open(transcript_path, "r", encoding="utf-8") as fh:
        text = fh.read()
    assert text.endswith("\n"), (
        f"Transcript file {transcript_path} must end with a trailing newline."
    )
    # No CRLF endings.
    assert "\r\n" not in text, (
        f"Transcript file {transcript_path} must use LF line endings, not CRLF."
    )


def test_gradle_built_headless_module() -> None:
    headless_build = os.path.join(PROJECT_DIR, "headless", "build")
    assert os.path.isdir(headless_build), (
        f"Headless module build output directory {headless_build} not found. "
        "The :headless module must be built at least once."
    )
