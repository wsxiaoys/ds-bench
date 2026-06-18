import os
import stat
import subprocess
import textwrap

import pytest

PROJECT_DIR = "/home/user/myproject"
RUN_SH = os.path.join(PROJECT_DIR, "run.sh")


def _run_script(script_text: str, tmp_path) -> subprocess.CompletedProcess:
    script_path = tmp_path / "script.txt"
    script_path.write_text(textwrap.dedent(script_text), encoding="utf-8")
    return subprocess.run(
        ["bash", RUN_SH, str(script_path)],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=600,
    )


def test_run_sh_exists_and_executable():
    assert os.path.isfile(RUN_SH), (
        f"Expected runner script at {RUN_SH}. The task requires a bash 'run.sh' "
        "wrapper at the project root."
    )
    mode = os.stat(RUN_SH).st_mode
    assert mode & (stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH), (
        f"run.sh at {RUN_SH} must be executable (chmod +x)."
    )


def test_build_gradle_pins_libgdx_1_14_2():
    # Search recursively for a build.gradle / build.gradle.kts containing the
    # exact headless backend dependency string.
    found = False
    expected_tokens = ("gdx-backend-headless", "1.14.2")
    for root, _dirs, files in os.walk(PROJECT_DIR):
        if "/build/" in root or root.endswith("/build"):
            continue
        for fname in files:
            if fname in ("build.gradle", "build.gradle.kts"):
                p = os.path.join(root, fname)
                try:
                    txt = open(p, encoding="utf-8").read()
                except OSError:
                    continue
                if all(tok in txt for tok in expected_tokens):
                    found = True
                    break
        if found:
            break
    assert found, (
        "Could not find any build.gradle that pulls in 'gdx-backend-headless' "
        "version '1.14.2'. The task mandates using libGDX 1.14.2 headless backend."
    )


def test_case1_overlap_and_containment(tmp_path):
    script = """\
        # unit squares
        POLY A 0 0 10 0 10 10 0 10
        POLY B 5 5 15 5 15 15 5 15
        POLY C 20 20 30 20 30 30 20 30
        OVERLAP A B
        OVERLAP A C
        CONTAINS A 5 5
        CONTAINS A 15 15
        AREA A
    """
    result = _run_script(script, tmp_path)
    assert result.returncode == 0, (
        f"run.sh exited with non-zero code {result.returncode}. "
        f"stdout={result.stdout!r} stderr={result.stderr!r}"
    )
    expected = (
        "POLY A 4\n"
        "POLY B 4\n"
        "POLY C 4\n"
        "OVERLAP A B true\n"
        "OVERLAP A C false\n"
        "CONTAINS A 5 5 true\n"
        "CONTAINS A 15 15 false\n"
        "AREA A 100.000\n"
    )
    assert result.stdout == expected, (
        f"Case 1 output mismatch.\nExpected:\n{expected}\nGot:\n{result.stdout}"
    )


def test_case2_segment_intersection(tmp_path):
    script = """\
        SEGMENTS 0 0 10 10 0 10 10 0
        SEGMENTS 0 0 10 0 0 5 10 5
        SEGMENTS 0 0 1 0 2 0 3 0
    """
    result = _run_script(script, tmp_path)
    assert result.returncode == 0, (
        f"run.sh exited with non-zero code {result.returncode}. "
        f"stdout={result.stdout!r} stderr={result.stderr!r}"
    )
    expected = (
        "SEGMENTS hit 5.000 5.000\n"
        "SEGMENTS miss\n"
        "SEGMENTS miss\n"
    )
    assert result.stdout == expected, (
        f"Case 2 output mismatch.\nExpected:\n{expected}\nGot:\n{result.stdout}"
    )


def test_case3_comments_blanks_and_errors(tmp_path):
    script = """\
        # define one polygon
        POLY P 0 0 4 0 4 3 0 3

        AREA P
        CONTAINS Q 1 1
        FOO bar baz
        AREA P
    """
    result = _run_script(script, tmp_path)
    assert result.returncode == 0, (
        f"run.sh exited with non-zero code {result.returncode}. "
        f"stdout={result.stdout!r} stderr={result.stderr!r}"
    )
    expected = (
        "POLY P 4\n"
        "AREA P 12.000\n"
        "ERROR 5 CONTAINS\n"
        "ERROR 6 FOO\n"
        "AREA P 12.000\n"
    )
    assert result.stdout == expected, (
        f"Case 3 output mismatch.\nExpected:\n{expected}\nGot:\n{result.stdout}"
    )


def test_case4_stdout_is_only_program_output(tmp_path):
    script = """\
        POLY A 0 0 2 0 2 2 0 2
        OVERLAP A A
    """
    result = _run_script(script, tmp_path)
    assert result.returncode == 0, (
        f"run.sh exited with non-zero code {result.returncode}. "
        f"stdout={result.stdout!r} stderr={result.stderr!r}"
    )
    expected = "POLY A 4\nOVERLAP A A true\n"
    assert result.stdout == expected, (
        "Case 4 stdout must contain ONLY the program result lines (no Gradle "
        f"banners or extra logging).\nExpected:\n{expected}\nGot:\n{result.stdout}"
    )


def test_case5_triangle_area_and_containment(tmp_path):
    script = """\
        POLY T 0 0 6 0 3 4
        AREA T
        CONTAINS T 3 1
        CONTAINS T 5 4
    """
    result = _run_script(script, tmp_path)
    assert result.returncode == 0, (
        f"run.sh exited with non-zero code {result.returncode}. "
        f"stdout={result.stdout!r} stderr={result.stderr!r}"
    )
    expected = (
        "POLY T 3\n"
        "AREA T 12.000\n"
        "CONTAINS T 3 1 true\n"
        "CONTAINS T 5 4 false\n"
    )
    assert result.stdout == expected, (
        f"Case 5 output mismatch.\nExpected:\n{expected}\nGot:\n{result.stdout}"
    )
