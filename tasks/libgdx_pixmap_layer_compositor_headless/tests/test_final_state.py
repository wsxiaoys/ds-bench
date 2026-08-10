import json
import os
import subprocess
import tempfile

import pytest
from PIL import Image

PROJECT_DIR = "/home/user/pixmap-compositor"
RUN_TIMEOUT = 900

FNV_OFFSET = 0xCBF29CE484222325
FNV_PRIME = 0x100000001B3
MASK64 = 0xFFFFFFFFFFFFFFFF


# --------------------------------------------------------------------------- #
# Independent reference implementation of the exact compositing specification. #
# --------------------------------------------------------------------------- #
def div255(v):
    return (v + 127) // 255


def divA(n, a):
    if a <= 0:
        return 0
    return (n + (a >> 1)) // a


def _tokenize_scene(text):
    lines = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        lines.append(line.split())
    return lines


def parse_scene(text):
    lines = _tokenize_scene(text)
    idx = 0
    assert lines, "empty scene"
    assert lines[idx][0] == "canvas", f"scene must start with canvas, got {lines[idx]}"
    W = int(lines[idx][1])
    H = int(lines[idx][2])
    idx += 1
    background = (0, 0, 0, 0)
    if idx < len(lines) and lines[idx][0] == "background":
        t = lines[idx]
        background = (int(t[1]), int(t[2]), int(t[3]), int(t[4]))
        idx += 1

    def parse_entries(i, stop_on_end):
        entries = []
        while i < len(lines):
            t = lines[i]
            head = t[0]
            if head == "end":
                assert stop_on_end, "unexpected 'end'"
                return entries, i + 1
            if head == "group":
                blend = t[1]
                opacity = int(t[2])
                children, i = parse_entries(i + 1, True)
                entries.append({"kind": "group", "blend": blend, "opacity": opacity, "entries": children})
                continue
            assert head == "layer", f"unexpected token {head}"
            kind = t[1]
            blend = t[2]
            opacity = int(t[3])
            rest = [int(x) for x in t[5:]] if kind == "gradient" else [int(x) for x in t[4:]]
            e = {"kind": kind, "blend": blend, "opacity": opacity}
            if kind == "solid":
                e["color"] = tuple(rest[0:4])
            elif kind == "rect":
                e["x"], e["y"], e["w"], e["h"] = rest[0:4]
                e["color"] = tuple(rest[4:8])
            elif kind == "circle":
                e["cx"], e["cy"], e["rad"] = rest[0:3]
                e["color"] = tuple(rest[3:7])
            elif kind == "gradient":
                e["orient"] = t[4]
                e["c0"] = tuple(rest[0:4])
                e["c1"] = tuple(rest[4:8])
            else:
                raise AssertionError(f"unknown layer kind {kind}")
            entries.append(e)
            i += 1
        assert not stop_on_end, "missing 'end' for group"
        return entries, i

    entries, _ = parse_entries(idx, False)
    return W, H, background, entries


def layer_source(e, W, H):
    n = W * H
    sr = [0] * n
    sg = [0] * n
    sb = [0] * n
    sa = [0] * n
    kind = e["kind"]
    if kind == "group":
        gr, gg, gb, ga = new_canvas(W, H, (0, 0, 0, 0))
        composite_entries(e["entries"], W, H, gr, gg, gb, ga)
        return gr, gg, gb, ga
    if kind == "solid":
        r, g, b, a = e["color"]
        for p in range(n):
            sr[p], sg[p], sb[p], sa[p] = r, g, b, a
        return sr, sg, sb, sa
    if kind == "rect":
        r, g, b, a = e["color"]
        x0, y0, w, h = e["x"], e["y"], e["w"], e["h"]
        if w > 0 and h > 0:
            for y in range(max(0, y0), min(H, y0 + h)):
                base = y * W
                for x in range(max(0, x0), min(W, x0 + w)):
                    p = base + x
                    sr[p], sg[p], sb[p], sa[p] = r, g, b, a
        return sr, sg, sb, sa
    if kind == "circle":
        r, g, b, a = e["color"]
        cx, cy, rad = e["cx"], e["cy"], e["rad"]
        rr = rad * rad
        for y in range(H):
            dy = y - cy
            base = y * W
            for x in range(W):
                dx = x - cx
                if dx * dx + dy * dy <= rr:
                    p = base + x
                    sr[p], sg[p], sb[p], sa[p] = r, g, b, a
        return sr, sg, sb, sa
    if kind == "gradient":
        c0 = e["c0"]
        c1 = e["c1"]
        horizontal = e["orient"] == "horizontal"
        denom = (W - 1) if horizontal else (H - 1)
        half = denom >> 1
        for y in range(H):
            base = y * W
            for x in range(W):
                i = x if horizontal else y
                p = base + x
                if denom == 0:
                    sr[p], sg[p], sb[p], sa[p] = c0
                else:
                    vals = []
                    for ch in range(4):
                        vals.append((c0[ch] * (denom - i) + c1[ch] * i + half) // denom)
                    sr[p], sg[p], sb[p], sa[p] = vals
        return sr, sg, sb, sa
    raise AssertionError(f"unknown kind {kind}")


def new_canvas(W, H, bg):
    n = W * H
    return [bg[0]] * n, [bg[1]] * n, [bg[2]] * n, [bg[3]] * n


def composite_entries(entries, W, H, dr, dg, db, da):
    n = W * H
    for e in entries:
        sr, sg, sb, sa = layer_source(e, W, H)
        blend = e["blend"]
        opacity = e["opacity"]
        for p in range(n):
            sap = div255(sa[p] * opacity)
            if sap == 0:
                continue
            Sr, Sg, Sb = sr[p], sg[p], sb[p]
            Dr, Dg, Db, Da = dr[p], dg[p], db[p], da[p]
            if blend == "normal":
                Br, Bg, Bb = Sr, Sg, Sb
            elif blend == "multiply":
                Br = div255(Sr * Dr)
                Bg = div255(Sg * Dg)
                Bb = div255(Sb * Db)
            elif blend == "additive":
                Br = min(255, Sr + Dr)
                Bg = min(255, Sg + Dg)
                Bb = min(255, Sb + Db)
            else:
                raise AssertionError(f"unknown blend {blend}")
            Dw = div255(Da * (255 - sap))
            outA = sap + Dw
            dr[p] = divA(Br * sap + Dr * Dw, outA)
            dg[p] = divA(Bg * sap + Dg * Dw, outA)
            db[p] = divA(Bb * sap + Db * Dw, outA)
            da[p] = outA
    return dr, dg, db, da


def reference_composite(text):
    W, H, background, entries = parse_scene(text)
    dr, dg, db, da = new_canvas(W, H, background)
    composite_entries(entries, W, H, dr, dg, db, da)
    n = W * H
    buf = bytearray(n * 4)
    for p in range(n):
        o = p * 4
        buf[o] = dr[p]
        buf[o + 1] = dg[p]
        buf[o + 2] = db[p]
        buf[o + 3] = da[p]
    sum_r = sum(dr)
    sum_g = sum(dg)
    sum_b = sum(db)
    sum_a = sum(da)
    opaque = sum(1 for v in da if v == 255)
    h = FNV_OFFSET
    for byte in buf:
        h = ((h ^ byte) * FNV_PRIME) & MASK64
    return {
        "W": W,
        "H": H,
        "buf": bytes(buf),
        "sum": (sum_r, sum_g, sum_b, sum_a),
        "mean": (sum_r / n, sum_g / n, sum_b / n, sum_a / n),
        "opaque": opaque,
        "hash": format(h, "016x"),
        "dr": dr,
        "dg": dg,
        "db": db,
        "da": da,
    }


# --------------------------------------------------------------------------- #
# Harness                                                                      #
# --------------------------------------------------------------------------- #
def run_case(scene_text):
    tmpdir = tempfile.mkdtemp(prefix="pixcomp_")
    scene_path = os.path.join(tmpdir, "scene.scene")
    out_png = os.path.join(tmpdir, "out.png")
    report_path = os.path.join(tmpdir, "report.json")
    with open(scene_path, "w") as f:
        f.write(scene_text)
    for p in (out_png, report_path):
        if os.path.exists(p):
            os.remove(p)
    result = subprocess.run(
        ["bash", "run.sh", scene_path, out_png, report_path],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=RUN_TIMEOUT,
    )
    return result, out_png, report_path


def decode_png(path):
    with Image.open(path) as img:
        rgba = img.convert("RGBA")
        return rgba.width, rgba.height, rgba.tobytes()


def assert_report_matches(report, ref):
    assert report["width"] == ref["W"], f"width {report['width']} != {ref['W']}"
    assert report["height"] == ref["H"], f"height {report['height']} != {ref['H']}"
    s = report["sum"]
    assert (int(s["r"]), int(s["g"]), int(s["b"]), int(s["a"])) == ref["sum"], (
        f"channel sums {s} != reference {ref['sum']}"
    )
    m = report["mean"]
    for key, expected in zip(("r", "g", "b", "a"), ref["mean"]):
        assert abs(float(m[key]) - expected) <= 1e-4, (
            f"mean_{key} {m[key]} != reference {expected}"
        )
    assert int(report["opaque_pixels"]) == ref["opaque"], (
        f"opaque_pixels {report['opaque_pixels']} != reference {ref['opaque']}"
    )
    assert str(report["hash"]).lower() == ref["hash"], (
        f"hash {report['hash']} != reference {ref['hash']}"
    )


def check_scene(scene_text):
    ref = reference_composite(scene_text)
    result, out_png, report_path = run_case(scene_text)
    assert result.returncode == 0, (
        f"run.sh exited {result.returncode}.\nstdout={result.stdout}\nstderr={result.stderr}"
    )
    assert os.path.isfile(out_png), f"output PNG not created at {out_png}"
    assert os.path.isfile(report_path), f"report JSON not created at {report_path}"
    w, h, data = decode_png(out_png)
    assert (w, h) == (ref["W"], ref["H"]), f"PNG size {(w, h)} != reference {(ref['W'], ref['H'])}"
    assert data == ref["buf"], "decoded PNG pixels are not pixel-identical to the reference composite"
    with open(report_path) as f:
        report = json.load(f)
    assert_report_matches(report, ref)
    return ref, report, data


# --------------------------------------------------------------------------- #
# Scene fixtures (mirroring the truth verification plan)                       #
# --------------------------------------------------------------------------- #
BASIC_SCENE = """canvas 4 4
background 0 0 0 255
layer rect normal 255 0 0 2 2 255 0 0 128
"""

GRAD_SCENE = """canvas 8 4
background 5 5 5 255
layer gradient normal 255 horizontal 0 0 0 255 255 254 253 255
layer solid additive 255 200 200 200 255
"""

GROUP_SCENE = """canvas 10 10
background 240 240 240 255
group multiply 200
  layer solid normal 255 128 128 128 255
  layer circle additive 255 5 5 3 40 20 10 255
end
layer rect normal 160 1 1 8 8 10 60 200 255
layer circle normal 255 5 5 0 0 0 0 255
"""

ALPHA_SCENE = """canvas 6 5
layer rect normal 255 0 0 6 2 255 0 0 255
layer rect normal 128 0 3 6 2 0 0 255 255
"""


# --------------------------------------------------------------------------- #
# Tests                                                                        #
# --------------------------------------------------------------------------- #
def _iter_source_files():
    sources = []
    for root, dirs, files in os.walk(PROJECT_DIR):
        dirs[:] = [d for d in dirs if d not in ("build", ".gradle", ".git", "bin", "out")]
        for name in files:
            if name.endswith((".java", ".kt")):
                sources.append(os.path.join(root, name))
    return sources


def test_headless_and_api_constraints():
    sources = _iter_source_files()
    assert sources, f"no Java/Kotlin source files found under {PROJECT_DIR}"
    combined = ""
    for path in sources:
        with open(path, "r", errors="replace") as f:
            combined += f.read() + "\n"
    assert "HeadlessApplication" in combined, (
        "sources must use the libGDX headless backend (HeadlessApplication)"
    )
    assert "Pixmap" in combined, "sources must use Pixmap"
    assert "PixmapIO" in combined, "sources must write PNG via PixmapIO"
    for forbidden in ("SpriteBatch", "ShapeRenderer", "FrameBuffer", "Gdx.gl"):
        assert forbidden not in combined, (
            f"forbidden GL-dependent API used: {forbidden}"
        )
    for texture_token in ("Texture ", "Texture(", "Texture;", "Texture."):
        assert texture_token not in combined, (
            f"forbidden Texture usage detected: {texture_token!r}"
        )


def test_basic_rect_over_opaque_background():
    ref, report, _ = check_scene(BASIC_SCENE)
    assert ref["opaque"] == 16, "all 16 pixels should be fully opaque over an opaque background"
    assert report["width"] == 4 and report["height"] == 4


def test_gradient_rounding_and_additive_clamp():
    check_scene(GRAD_SCENE)


def test_nested_group_multiply_circle_and_opacity():
    ref, report, _ = check_scene(GROUP_SCENE)
    assert report["width"] == 10 and report["height"] == 10


def test_transparent_background_and_no_vertical_flip():
    ref, report, data = check_scene(ALPHA_SCENE)
    W, H = ref["W"], ref["H"]
    # Top two rows (y=0,1) must be the fully opaque red band; not vertically flipped.
    for y in (0, 1):
        for x in range(W):
            o = (y * W + x) * 4
            assert (data[o], data[o + 1], data[o + 2], data[o + 3]) == (255, 0, 0, 255), (
                f"pixel ({x},{y}) expected opaque red at top, got {tuple(data[o:o + 4])}"
            )
    # Middle row (y=2) is uncovered -> fully transparent.
    for x in range(W):
        o = (2 * W + x) * 4
        assert data[o + 3] == 0, f"pixel ({x},2) expected alpha 0, got {data[o + 3]}"
