import os
import re
import subprocess

import pytest
from PIL import Image


PROJECT_DIR = "/home/user/pixmap-renderer"
RUN_SH = "run.sh"

INPUT_PATH = "/tmp/pixmap_input.txt"
OUTPUT_PATH = "/tmp/pixmap_out.png"

RENDER_OK_RE = re.compile(
    r"^RENDER_OK width=(?P<w>\d+) height=(?P<h>\d+) commands=(?P<n>\d+)$",
    re.MULTILINE,
)


def _cleanup_artifacts():
    for path in (INPUT_PATH, OUTPUT_PATH):
        if os.path.exists(path):
            os.remove(path)


def _write_input(script: str) -> None:
    with open(INPUT_PATH, "w", encoding="utf-8") as f:
        f.write(script)


def _run_renderer():
    return subprocess.run(
        ["bash", RUN_SH, INPUT_PATH, OUTPUT_PATH],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=900,
    )


def _assert_close(actual, expected, tolerance: int = 4, where: str = ""):
    assert len(actual) == len(expected) == 4, (
        f"Pixel comparison requires RGBA tuples; got actual={actual}, expected={expected}."
    )
    for i, channel in enumerate(("R", "G", "B", "A")):
        diff = abs(int(actual[i]) - int(expected[i]))
        assert diff <= tolerance, (
            f"Pixel {where} channel {channel} differs by {diff} (>{tolerance}). "
            f"actual={actual}, expected={expected}."
        )


@pytest.fixture(autouse=True)
def _per_test_cleanup():
    _cleanup_artifacts()
    yield
    _cleanup_artifacts()


def test_run_sh_present():
    run_sh_path = os.path.join(PROJECT_DIR, RUN_SH)
    assert os.path.isfile(run_sh_path), (
        f"Expected run.sh entrypoint at {run_sh_path}, but it is missing."
    )


def test_single_fill_image():
    _write_input("SIZE 8 8\nFILL 200 50 50 255\n")
    result = _run_renderer()
    assert result.returncode == 0, (
        f"run.sh exited with status {result.returncode}.\nstdout=\n{result.stdout}\n"
        f"stderr=\n{result.stderr}"
    )
    match = RENDER_OK_RE.search(result.stdout)
    assert match is not None, (
        f"Expected stdout to contain a 'RENDER_OK width=8 height=8 commands=1' line.\n"
        f"stdout=\n{result.stdout}"
    )
    assert (match.group("w"), match.group("h"), match.group("n")) == ("8", "8", "1"), (
        f"Summary mismatch: got width={match.group('w')}, height={match.group('h')}, "
        f"commands={match.group('n')}; expected 8/8/1."
    )

    assert os.path.isfile(OUTPUT_PATH), (
        f"PNG output file was not created at {OUTPUT_PATH}."
    )
    with Image.open(OUTPUT_PATH) as img:
        assert img.size == (8, 8), f"PNG size mismatch: got {img.size}, expected (8, 8)."
        img_rgba = img.convert("RGBA")
        for y in range(8):
            for x in range(8):
                _assert_close(
                    img_rgba.getpixel((x, y)),
                    (200, 50, 50, 255),
                    where=f"({x},{y})",
                )


def test_composite_drawing():
    _write_input(
        "# rectangle and circle composition\n"
        "SIZE 16 16\n"
        "FILL 0 0 0 255\n"
        "RECT 2 2 12 12 0 128 0 255\n"
        "CIRCLE 8 8 3 255 255 0 255\n"
        "PIXEL 0 0 255 0 0 255\n"
    )
    result = _run_renderer()
    assert result.returncode == 0, (
        f"run.sh exited with status {result.returncode}.\nstdout=\n{result.stdout}\n"
        f"stderr=\n{result.stderr}"
    )
    match = RENDER_OK_RE.search(result.stdout)
    assert match is not None, (
        f"Expected stdout to contain a 'RENDER_OK width=16 height=16 commands=4' line.\n"
        f"stdout=\n{result.stdout}"
    )
    assert (
        match.group("w"),
        match.group("h"),
        match.group("n"),
    ) == ("16", "16", "4"), (
        f"Summary mismatch: got width={match.group('w')}, height={match.group('h')}, "
        f"commands={match.group('n')}; expected 16/16/4."
    )

    assert os.path.isfile(OUTPUT_PATH), (
        f"PNG output file was not created at {OUTPUT_PATH}."
    )
    with Image.open(OUTPUT_PATH) as img:
        assert img.size == (16, 16), (
            f"PNG size mismatch: got {img.size}, expected (16, 16)."
        )
        img_rgba = img.convert("RGBA")
        # PIXEL command overwrites the top-left corner with red.
        _assert_close(img_rgba.getpixel((0, 0)), (255, 0, 0, 255), where="(0,0)")
        # Centre of the circle should be yellow.
        _assert_close(img_rgba.getpixel((8, 8)), (255, 255, 0, 255), where="(8,8)")
        # Corner of the green rectangle, well outside the circle radius.
        _assert_close(img_rgba.getpixel((3, 3)), (0, 128, 0, 255), where="(3,3)")
        # Outside the 2..13 inclusive rectangle band — should still be the black fill.
        _assert_close(
            img_rgba.getpixel((15, 15)), (0, 0, 0, 255), where="(15,15)"
        )


def test_line_drawing():
    _write_input(
        "SIZE 10 10\n"
        "FILL 255 255 255 255\n"
        "LINE 0 0 9 0 0 0 255 255\n"
    )
    result = _run_renderer()
    assert result.returncode == 0, (
        f"run.sh exited with status {result.returncode}.\nstdout=\n{result.stdout}\n"
        f"stderr=\n{result.stderr}"
    )
    match = RENDER_OK_RE.search(result.stdout)
    assert match is not None, (
        f"Expected stdout to contain a 'RENDER_OK width=10 height=10 commands=2' line.\n"
        f"stdout=\n{result.stdout}"
    )
    assert (
        match.group("w"),
        match.group("h"),
        match.group("n"),
    ) == ("10", "10", "2"), (
        f"Summary mismatch: got width={match.group('w')}, height={match.group('h')}, "
        f"commands={match.group('n')}; expected 10/10/2."
    )

    assert os.path.isfile(OUTPUT_PATH), (
        f"PNG output file was not created at {OUTPUT_PATH}."
    )
    with Image.open(OUTPUT_PATH) as img:
        assert img.size == (10, 10), (
            f"PNG size mismatch: got {img.size}, expected (10, 10)."
        )
        img_rgba = img.convert("RGBA")
        _assert_close(img_rgba.getpixel((0, 0)), (0, 0, 255, 255), where="(0,0)")
        _assert_close(img_rgba.getpixel((9, 0)), (0, 0, 255, 255), where="(9,0)")
        _assert_close(
            img_rgba.getpixel((5, 5)), (255, 255, 255, 255), where="(5,5)"
        )
