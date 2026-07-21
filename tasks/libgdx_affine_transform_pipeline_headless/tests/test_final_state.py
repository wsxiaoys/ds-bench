import math
import os
import subprocess

import pytest

PROJECT_DIR = "/home/user/affine-pipeline"
INPUT_PATH = "/tmp/affine_in.txt"
OUTPUT_PATH = "/tmp/affine_out.txt"
OUTPUT_PATH_2 = "/tmp/affine_out2.txt"

# Concrete input program from the verification plan.
INPUT_PROGRAM = """# pipelines
define base
  translate 10 0
  rotate 90
end

define composed
  scale 2 3
  use base
  shear 0 0
end

define flip
  scale 1 -1
end

define squash
  scale 1 0
end

point base 1 0
polygon composed 0 0 1 0 1 1
inverse composed 2 5
polygon flip 0 0 2 0 0 2
inverse squash 3 4
"""

# Tolerances for numeric comparison (see verification plan).
NUM_ATOL = 1e-2
NUM_RTOL = 2e-3
AREA_ATOL = 1e-1
AREA_RTOL = 5e-3

RUN_TIMEOUT = 600


# ---------------------------------------------------------------------------
# Independent reference implementation of the pinned affine-pipeline semantics.
# A matrix is the 6-tuple (m00, m01, m02, m10, m11, m12); bottom row is (0,0,1).
# ---------------------------------------------------------------------------

def _identity():
    return (1.0, 0.0, 0.0, 0.0, 1.0, 0.0)


def _mat_mul(l, r):
    """Post-multiply: returns L . R (accumulator L on the left)."""
    l00, l01, l02, l10, l11, l12 = l
    r00, r01, r02, r10, r11, r12 = r
    return (
        l00 * r00 + l01 * r10,
        l00 * r01 + l01 * r11,
        l00 * r02 + l01 * r12 + l02,
        l10 * r00 + l11 * r10,
        l10 * r01 + l11 * r11,
        l10 * r02 + l11 * r12 + l12,
    )


def _op_matrix(op, pipelines):
    kind = op[0]
    if kind == "translate":
        tx, ty = op[1], op[2]
        return (1.0, 0.0, tx, 0.0, 1.0, ty)
    if kind == "rotate":
        rad = math.radians(op[1])
        c, s = math.cos(rad), math.sin(rad)
        return (c, -s, 0.0, s, c, 0.0)
    if kind == "scale":
        sx, sy = op[1], op[2]
        return (sx, 0.0, 0.0, 0.0, sy, 0.0)
    if kind == "shear":
        shx, shy = op[1], op[2]
        return (1.0, shx, 0.0, shy, 1.0, 0.0)
    if kind == "use":
        return pipelines[op[1]]
    raise ValueError(f"unknown op {kind}")


def _det(m):
    return m[0] * m[4] - m[1] * m[3]


def _apply(m, x, y):
    return (m[0] * x + m[1] * y + m[2], m[3] * x + m[4] * y + m[5])


def _inverse(m):
    m00, m01, m02, m10, m11, m12 = m
    det = _det(m)
    return (
        m11 / det,
        -m01 / det,
        (m01 * m12 - m11 * m02) / det,
        -m10 / det,
        m00 / det,
        (m10 * m02 - m00 * m12) / det,
    )


def _parse_and_eval(program):
    """Parse the program and return an ordered list of expected token specs.

    Each command yields a list of tokens where a token is either:
      ("kw", str)   -> must match exactly
      ("num", float)-> compared numerically with NUM_* tolerance
      ("area", float)-> compared numerically with AREA_* tolerance
    """
    pipelines = {}
    commands = []
    cur_name = None
    cur_ops = []
    for raw in program.splitlines():
        line = raw.split("#", 1)[0].strip()
        if not line:
            continue
        toks = line.split()
        head = toks[0]
        if head == "define":
            cur_name = toks[1]
            cur_ops = []
        elif head == "end":
            m = _identity()
            for op in cur_ops:
                m = _mat_mul(m, _op_matrix(op, pipelines))
            pipelines[cur_name] = m
            cur_name = None
        elif head in ("translate", "scale", "shear"):
            cur_ops.append((head, float(toks[1]), float(toks[2])))
        elif head == "rotate":
            cur_ops.append((head, float(toks[1])))
        elif head == "use":
            cur_ops.append((head, toks[1]))
        elif head in ("point", "polygon", "inverse"):
            commands.append(toks)
        else:
            raise ValueError(f"unknown line: {line}")

    expected = []
    for toks in commands:
        kind = toks[0]
        name = toks[1]
        m = pipelines[name]
        nums = [float(t) for t in toks[2:]]
        if kind == "point":
            x, y = nums[0], nums[1]
            ix, iy = _apply(m, x, y)
            row = [("kw", "point"), ("kw", name), ("kw", "matrix")]
            row += [("num", v) for v in m]
            row += [("kw", "image"), ("num", ix), ("num", iy)]
            expected.append(row)
        elif kind == "polygon":
            verts = [(nums[i], nums[i + 1]) for i in range(0, len(nums), 2)]
            timg = [_apply(m, vx, vy) for (vx, vy) in verts]
            k = len(timg)
            area = 0.0
            for i in range(k):
                x0, y0 = timg[i]
                x1, y1 = timg[(i + 1) % k]
                area += x0 * y1 - x1 * y0
            area *= 0.5
            d = _det(m)
            orient = "preserved" if d > 0 else ("flipped" if d < 0 else "degenerate")
            row = [("kw", "polygon"), ("kw", name), ("kw", "matrix")]
            row += [("num", v) for v in m]
            row += [("kw", "area"), ("area", area), ("kw", "orient"), ("kw", orient), ("kw", "image")]
            for (vx, vy) in timg:
                row += [("num", vx), ("num", vy)]
            expected.append(row)
        elif kind == "inverse":
            px, py = nums[0], nums[1]
            row = [("kw", "inverse"), ("kw", name), ("kw", "matrix")]
            row += [("num", v) for v in m]
            if _det(m) == 0:
                row += [("kw", "singular")]
            else:
                qx, qy = _apply(m, px, py)
                inv = _inverse(m)
                bx, by = _apply(inv, qx, qy)
                residual = math.hypot(px - bx, py - by)
                token = "ok" if residual <= 1e-3 else "fail"
                row += [("kw", "forward"), ("num", qx), ("num", qy),
                        ("kw", "back"), ("num", bx), ("num", by),
                        ("kw", "residual"), ("num", residual), ("kw", token)]
            expected.append(row)
    return expected


def _run_interpreter(output_path):
    if os.path.exists(output_path):
        os.remove(output_path)
    cmd = [
        "gradle", "--offline", "--console=plain", "-q", "run",
        f"--args=--input={INPUT_PATH} --output={output_path}",
    ]
    try:
        proc = subprocess.run(
            cmd,
            cwd=PROJECT_DIR,
            capture_output=True,
            text=True,
            timeout=RUN_TIMEOUT,
            env=os.environ.copy(),
        )
    except subprocess.TimeoutExpired as exc:
        pytest.fail(
            "The interpreter did not terminate within the time bound "
            f"({RUN_TIMEOUT}s); the headless application likely did not exit. "
            f"stdout={exc.stdout!r} stderr={exc.stderr!r}"
        )
    print("=== gradle stdout ===")
    print(proc.stdout)
    print("=== gradle stderr ===")
    print(proc.stderr)
    return proc


@pytest.fixture(scope="module")
def run_result():
    with open(INPUT_PATH, "w", encoding="utf-8") as f:
        f.write(INPUT_PROGRAM)
    proc = _run_interpreter(OUTPUT_PATH)
    return proc


@pytest.fixture(scope="module")
def expected_rows():
    return _parse_and_eval(INPUT_PROGRAM)


def _read_lines(path):
    with open(path, encoding="utf-8") as f:
        return [ln for ln in f.read().splitlines() if ln.strip()]


def _compare_token(spec, actual, line_no, tok_no):
    kind, value = spec
    if kind == "kw":
        assert actual == value, (
            f"line {line_no} token {tok_no}: expected keyword '{value}', got '{actual}'"
        )
        return
    try:
        got = float(actual)
    except ValueError:
        pytest.fail(f"line {line_no} token {tok_no}: expected a number, got '{actual}'")
        return
    if kind == "area":
        atol, rtol = AREA_ATOL, AREA_RTOL
    else:
        atol, rtol = NUM_ATOL, NUM_RTOL
    tol = atol + rtol * abs(value)
    assert abs(got - value) <= tol, (
        f"line {line_no} token {tok_no}: expected {value:.4f} (+/- {tol:.5f}), got {got:.4f}"
    )


def test_run_exit_code_zero(run_result):
    assert run_result.returncode == 0, (
        f"Interpreter exited with non-zero status {run_result.returncode}. "
        f"stderr={run_result.stderr!r}"
    )


def test_output_file_created(run_result):
    assert os.path.isfile(OUTPUT_PATH), f"Output file {OUTPUT_PATH} was not created."


def test_output_line_count(run_result, expected_rows):
    lines = _read_lines(OUTPUT_PATH)
    assert len(lines) == len(expected_rows), (
        f"Expected {len(expected_rows)} output lines (one per command), got {len(lines)}: {lines}"
    )


def test_point_command(run_result, expected_rows):
    lines = _read_lines(OUTPUT_PATH)
    _assert_line(lines, expected_rows, 0)


def test_polygon_preserved_orientation(run_result, expected_rows):
    lines = _read_lines(OUTPUT_PATH)
    _assert_line(lines, expected_rows, 1)


def test_inverse_round_trip(run_result, expected_rows):
    lines = _read_lines(OUTPUT_PATH)
    _assert_line(lines, expected_rows, 2)


def test_polygon_flipped_orientation(run_result, expected_rows):
    lines = _read_lines(OUTPUT_PATH)
    _assert_line(lines, expected_rows, 3)


def test_inverse_singular(run_result, expected_rows):
    lines = _read_lines(OUTPUT_PATH)
    _assert_line(lines, expected_rows, 4)


def _assert_line(lines, expected_rows, idx):
    assert idx < len(lines), f"Missing output line {idx + 1}."
    actual = lines[idx].split()
    expected = expected_rows[idx]
    assert len(actual) == len(expected), (
        f"line {idx + 1}: expected {len(expected)} tokens, got {len(actual)}: {lines[idx]!r}"
    )
    for tok_no, (spec, act) in enumerate(zip(expected, actual)):
        _compare_token(spec, act, idx + 1, tok_no)


def test_output_is_deterministic(run_result):
    proc = _run_interpreter(OUTPUT_PATH_2)
    assert proc.returncode == 0, (
        f"Second run exited with non-zero status {proc.returncode}. stderr={proc.stderr!r}"
    )
    with open(OUTPUT_PATH, encoding="utf-8") as f:
        first = f.read()
    with open(OUTPUT_PATH_2, encoding="utf-8") as f:
        second = f.read()
    assert first == second, "Re-running with the same input produced different output."
