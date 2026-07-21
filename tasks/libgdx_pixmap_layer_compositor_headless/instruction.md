# Headless Pixmap Layer Compositor (libGDX 1.14.2)

## Background
libGDX ships a CPU-side image type, `com.badlogic.gdx.graphics.Pixmap`, that works
under the **headless backend** (`HeadlessApplication`) without any OpenGL context.
Your job is to build a deterministic, offline image compositor: it reads a *scene
description* file that defines a canvas and an ordered stack of layers, composites
those layers into a single image, writes the image as a PNG, and emits a JSON report
of deterministic statistics about the result.

## Requirements
- The program MUST run entirely under the libGDX **headless** backend
  (`HeadlessApplication`). It MUST NOT use `Texture`, `SpriteBatch`, `ShapeRenderer`,
  `FrameBuffer`, or any `Gdx.gl*` call. The final composited image MUST be materialized
  as a `Pixmap` in `RGBA8888` format and written to disk as a PNG using libGDX's PNG
  writer (`com.badlogic.gdx.graphics.PixmapIO`).
- Parse a scene description file (grammar below) defining the canvas size, an optional
  background color, and an ordered list of layers. A layer is either a procedurally
  generated shape (solid fill, filled rectangle, filled disc, or linear gradient) or a
  nested group of layers. Every layer carries a *blend mode* and an *opacity*.
- Composite the layers in order using the **exact integer arithmetic** specified below.
  You MUST implement the `multiply` and `additive` blend modes yourself on pixel values;
  the built-in `Pixmap` blending only offers `None`/`SourceOver` and MUST NOT be relied
  on to produce the required results.
- After compositing, write the PNG and emit a JSON report containing the image
  dimensions, per-channel sums, per-channel means, the count of fully opaque pixels, and
  a 64-bit FNV-1a hash of the raw `RGBA8888` byte buffer.

Everything must resolve and run fully **offline**; only Maven/Gradle-resolved libGDX
core + headless backend (+ desktop natives) may be used. Nothing may access the network
at run time.

## Color and pixel model
- Format is `RGBA8888`: 8 bits per channel, **straight (non-premultiplied) alpha**, each
  channel an integer in `[0, 255]`.
- Coordinate system: top-left origin, x increases to the right, y increases downward.
- Canonical raw byte buffer: row-major, rows top-to-bottom, within a row left-to-right,
  exactly 4 bytes per pixel in the order **R, G, B, A**. The written PNG MUST store rows
  in this same top-to-bottom order (i.e. NOT vertically flipped) so that decoding the PNG
  reproduces this exact byte buffer.

## Scene description grammar
The scene file is UTF-8 text, parsed line by line. Trim leading/trailing whitespace on
each line. Ignore blank lines and lines whose first non-space character is `#`. Tokens on
a line are separated by arbitrary runs of spaces and/or tabs. All numeric tokens are
base-10 integers; color channels are integers in `[0, 255]`; `opacity` is an integer in
`[0, 255]`; `blend` is one of `normal`, `multiply`, `additive`.

Line kinds (in this order):
1. Exactly one `canvas <W> <H>` line first, with `W >= 1` and `H >= 1`.
2. An optional `background <r> <g> <b> <a>` line. If omitted, the background is
   `0 0 0 0` (fully transparent black).
3. Zero or more top-level *entries*, in compositing order (the first entry is composited
   first, directly over the background; each subsequent entry is composited over the
   running result).

An *entry* is either a single-line layer or a group block:
- `layer solid    <blend> <opacity> <r> <g> <b> <a>`
- `layer rect     <blend> <opacity> <x> <y> <w> <h> <r> <g> <b> <a>`
- `layer circle   <blend> <opacity> <cx> <cy> <rad> <r> <g> <b> <a>`
- `layer gradient <blend> <opacity> <horizontal|vertical> <r0> <g0> <b0> <a0> <r1> <g1> <b1> <a1>`
- A group block:
  ```
  group <blend> <opacity>
    <entry>
    ...
  end
  ```
  Group blocks may nest arbitrarily. Indentation is cosmetic and insignificant.

## Shape source definition
Each layer defines, per canvas pixel `(x, y)`, a straight-alpha source color
`S = (Sr, Sg, Sb, Sa)` where a pixel is either *covered* (contributes `S`) or *uncovered*
(contributes nothing, equivalent to `Sa = 0`):
- `solid`: every pixel is covered with `S = (r, g, b, a)`.
- `rect`: pixel `(x, y)` is covered iff `x0 <= x < x0 + w` and `y0 <= y < y0 + h` and the
  pixel lies within the canvas; covered pixels use `S = (r, g, b, a)`. If `w <= 0` or
  `h <= 0` the layer covers nothing.
- `circle`: pixel `(x, y)` is covered iff `(x - cx)^2 + (y - cy)^2 <= rad^2` and the pixel
  lies within the canvas; covered pixels use `S = (r, g, b, a)`. `rad = 0` covers only the
  center pixel. (This exact disc rule defines the shape; do not depend on any library
  circle rasterizer.)
- `gradient`: every pixel is covered. Let `t` run along the chosen axis. For
  `horizontal`, `denom = W - 1` and `i = x`; for `vertical`, `denom = H - 1` and `i = y`.
  If `denom == 0`, every channel equals the corresponding channel of the first color.
  Otherwise, for each channel `c` (including alpha):
  `Sc = (c0 * (denom - i) + c1 * i + (denom >> 1)) / denom` using integer (floor) division,
  where `c0`/`c1` are the channel values of the first/second color.

## Exact compositing arithmetic
Define integer helpers (all divisions are integer/floor divisions on non-negative
operands):
- `div255(v)  = (v + 127) / 255`
- `divA(n, a) = (n + (a >> 1)) / a` for `a >= 1`; `divA(n, 0) = 0`

To composite one layer's source pixel `S = (Sr, Sg, Sb, Sa)` (with the layer's `opacity`
and `blend` mode) over the running destination pixel `D = (Dr, Dg, Db, Da)`:
1. Effective source alpha: `Sa' = div255(Sa * opacity)`.
2. If `Sa' == 0`, the destination pixel is left unchanged (this also covers uncovered
   pixels).
3. Otherwise compute the blended color `B` per channel `c in {r, g, b}`:
   - `normal`:   `Bc = Sc`
   - `multiply`: `Bc = div255(Sc * Dc)`
   - `additive`: `Bc = min(255, Sc + Dc)`
4. Source-over combine with the effective alpha:
   - `Dw   = div255(Da * (255 - Sa'))`
   - `outA = Sa' + Dw`
   - for each channel `c`: `outC = divA(Bc * Sa' + Dc * Dw, outA)`
   - The new destination pixel is `(outR, outG, outB, outA)`.

A `group` is composited by first flattening its child entries, in order, onto a fresh
fully transparent canvas (`0 0 0 0`) of the same `W x H`; the resulting image is then
used as the group's source `S` (per-pixel straight-alpha color) and composited over the
parent with the group's own `blend` and `opacity` using the same rules above.

The root canvas is initialized to the background color, then every top-level entry is
composited over it in order.

## Report and hash
- Per-channel sums are the sums over all `W * H` pixels of the final `R`, `G`, `B`, `A`
  values respectively.
- Per-channel means are `sum_c / (W * H)` as real numbers.
- Opaque-pixel count is the number of final pixels whose alpha equals `255`.
- The hash is a **64-bit FNV-1a** over the canonical raw `RGBA8888` byte buffer defined
  above (each byte processed in buffer order): start with `offset = 0xcbf29ce484222325`;
  for each byte `x`, `hash = ((hash XOR x) * 0x100000001b3) mod 2^64`. Report it as a
  16-character, lowercase, zero-padded hexadecimal string.

## Output
Write the report as JSON to the report path with exactly these keys and shapes:
```
{
  "width": <int>,
  "height": <int>,
  "sum":  {"r": <int>, "g": <int>, "b": <int>, "a": <int>},
  "mean": {"r": <number>, "g": <number>, "b": <number>, "a": <number>},
  "opaque_pixels": <int>,
  "hash": "<16-hex-lowercase>"
}
```

## Implementation Hints
- Project path: `/home/user/pixmap-compositor`
- Command: `bash run.sh <scene_file> <out_png> <report_json>` — run from the project
  path. It MUST read the scene from `<scene_file>`, write the PNG to `<out_png>`, and
  write the JSON report to `<report_json>`, then exit with status `0` on success. The
  three arguments are arbitrary absolute paths chosen by the caller.
- The library version is pinned to **libGDX 1.14.2**, running on its headless backend.
  Everything must build/run offline.
- The written PNG must be `RGBA8888`, non-premultiplied, with rows stored top-to-bottom
  (no vertical flip) so decoding it reproduces the canonical byte buffer exactly.
- Match the compositing arithmetic, rounding, gradient interpolation, shape coverage,
  group flattening, and hash definition above exactly; results are checked pixel-exact
  and against the exact report values.

