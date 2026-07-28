# Deterministic BSP Dungeon Generator (libGDX Headless)

## Background
Build a command-line procedural dungeon generator on top of the libGDX game framework (version 1.14.2). The generator must run entirely inside a libGDX **headless** application (no OpenGL/graphics) and must produce byte-for-byte reproducible output for a given seed by using libGDX's own seeded pseudo-random number generator.

## Requirements
- Read generation parameters from an input text file.
- Partition a rectangular tile grid using Binary Space Partitioning (BSP), carve one room per leaf region, and connect rooms with L-shaped corridors.
- All pseudo-randomness MUST come from a single `com.badlogic.gdx.math.RandomXS128` instance seeded with the input seed. The entire generation MUST execute within a running `com.badlogic.gdx.backends.headless.HeadlessApplication`. No OpenGL/GL calls may be made.
- Emit the BSP leaves, rooms, corridor segments, an ASCII map, and a 64-bit hash of that map.

## Implementation Hints
- Project path: /home/user/project
- Command: `bash /home/user/project/run.sh <input_file> <output_dir>`
  - The program reads parameters from `<input_file>`, performs generation, and writes exactly two files: `<output_dir>/output.json` and `<output_dir>/map.txt`. It must run to completion and exit with status 0. `<output_dir>` already exists when the command is invoked.
- The build MUST depend on the libGDX headless backend (`com.badlogicgames.gdx:gdx-backend-headless:1.14.2`) together with `com.badlogicgames.gdx:gdx:1.14.2`, and the generation logic MUST run inside a `HeadlessApplication`.
- No network access is available at build or run time beyond the dependencies already resolvable by the build system in the environment.

### Input file format
The input file contains exactly six lines, in this exact order, each a lowercase key and a value separated by a single space character:
```
seed <signed 64-bit integer>
width <int>
height <int>
min_leaf <int>
min_room <int>
max_depth <int>
```
Coordinates use a top-left origin: column `x` ranges over `[0, width)` and row `y` ranges over `[0, height)`. All provided inputs satisfy: `min_room >= 3`, `min_leaf >= min_room + 2`, `width >= min_leaf`, `height >= min_leaf`, and `max_depth >= 0`.

### RNG draws and partition rules (must be reproduced exactly)
Create one `RandomXS128` seeded with `seed`. Every random draw is `nextInt(bound)` on that single instance, consumed in the exact order defined by a pre-order depth-first traversal starting from the root region `(x=0, y=0, w=width, h=height)` at depth `0`.

For a region `(x, y, w, h)` at `depth`:
1. The region is an internal node (it is split) if and only if `depth < max_depth` AND at least one of `w >= 2*min_leaf` or `h >= 2*min_leaf` holds. Otherwise the region is a leaf.
2. When the region is split, choose the split axis:
   - if `w >= 2*min_leaf` and `h < 2*min_leaf`: split vertically;
   - else if `h >= 2*min_leaf` and `w < 2*min_leaf`: split horizontally;
   - else (both hold): draw `a = nextInt(2)` and split vertically if `a == 0`, otherwise horizontally.
3. Compute the split and create the two children:
   - Vertical split: `lw = min_leaf + nextInt(w - 2*min_leaf + 1)`. First child = `(x, y, lw, h)`; second child = `(x + lw, y, w - lw, h)`.
   - Horizontal split: `th = min_leaf + nextInt(h - 2*min_leaf + 1)`. First child = `(x, y, w, th)`; second child = `(x, y + th, w, h - th)`.
   Recurse into the first child completely, then into the second child.
4. When the region is a leaf, carve exactly one room inside it using four draws in this exact order, where `availW = w - 2` and `availH = h - 2`:
   - `rw = min_room + nextInt(availW - min_room + 1)`
   - `rh = min_room + nextInt(availH - min_room + 1)`
   - `rx = (x + 1) + nextInt(availW - rw + 1)`
   - `ry = (y + 1) + nextInt(availH - rh + 1)`
   The room rectangle is `(rx, ry, rw, rh)`.

### Corridor rules
The representative room of a node is: for a leaf, its own room; for an internal node, the representative room of its first child. For every internal node, visited in the same pre-order traversal, connect the centers of the representative rooms of its first and second child with an L-shaped corridor. The center of a room `(rx, ry, rw, rh)` is `(rx + rw / 2, ry + rh / 2)` using integer (floor) division. With `A = center(representative of first child)` and `B = center(representative of second child)`, the corridor is two straight segments carved as floor:
- a horizontal segment on row `A.y` covering every column between `A.x` and `B.x` inclusive;
- a vertical segment on column `B.x` covering every row between `A.y` and `B.y` inclusive.

### ASCII map (`map.txt`)
Start from a `width` x `height` grid where every tile is the wall character `#`. Set every tile inside every room rectangle to the floor character `.`, then set every tile on every corridor segment to `.`. Write `map.txt` as `height` lines, from row `y=0` (first) through row `y=height-1` (last); each line is exactly `width` characters followed by a single newline byte `\n` (0x0A), including the final line.

### `output.json`
Write a JSON object with exactly these keys:
- `seed`: the input seed (integer).
- `width`: integer.
- `height`: integer.
- `leaf_count`: number of leaves (integer).
- `leaves`: array of `[x, y, w, h]` leaf rectangles in pre-order traversal order (the order in which leaves are reached).
- `rooms`: array of `[x, y, w, h]` room rectangles sorted ascending by `y`, then by `x`.
- `corridors`: array of `[x1, y1, x2, y2]` segments in traversal order; for each internal node emit its horizontal segment followed by its vertical segment; each segment is normalized so that `x1 <= x2` and `y1 <= y2`.
- `map_hash`: a 16-character lowercase hexadecimal string, the 64-bit FNV-1a hash of the exact byte content of `map.txt`. FNV-1a is defined as: start with the 64-bit offset basis `0xcbf29ce484222325`; for each byte `b` of the file, set `hash = ((hash XOR b) * 0x100000001b3) mod 2^64`.

