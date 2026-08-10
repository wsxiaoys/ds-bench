# Spatial-Hash Broad-Phase Collision Simulation (libGDX Headless)

## Background
Build a deterministic 2D circle-collision simulator that runs entirely under the libGDX **headless** backend (`HeadlessApplication`, no OpenGL). Many moving circles live in a rectangular world. Each tick you integrate motion, bounce circles off the world walls, then detect and resolve circle-circle collisions. To keep collision detection scalable you must use a **uniform spatial hash** for the broad phase, so the number of exact circle-circle checks stays far below the O(n^2) all-pairs count.

Use libGDX version `1.14.2`. Implement all simulation data structures and geometry with libGDX's own classes only (for example `com.badlogic.gdx.utils.Array`, `ObjectMap`/`LongMap`, and `com.badlogic.gdx.math.Vector2`/`Circle`/`MathUtils`). Do not use `java.util` collections for the simulation data structures and do not add third-party libraries. No network access is available at build or run time; every dependency must resolve from the local Maven/Gradle cache.

## Requirements
Read a whitespace-delimited text input file describing the world and the circles, run a fixed-timestep simulation for the specified number of ticks, and write a results file containing the state at the specified checkpoints.

### Input file format
The input is a sequence of whitespace-separated numeric tokens (integers or decimals). Newlines are not significant beyond separating tokens. The tokens appear in exactly this order:
1. `W H` - world width and height. The world rectangle is `[0,W] x [0,H]`.
2. `C` - spatial-hash cell size (> 0).
3. `DT` - fixed timestep.
4. `T` - number of ticks (integer, >= 1).
5. `E` - restitution coefficient (applies to both wall bounces and circle-circle response).
6. `K` - number of checkpoints (integer, >= 1).
7. `K` tick numbers, strictly ascending, each in `[1, T]`.
8. `N` - number of circles (integer, >= 0).
9. `N` circle records, each being `id x y vx vy r`, where `id` is a unique non-negative integer, `(x,y)` is the position, `(vx,vy)` the velocity, and `r` the radius (> 0). Records may appear in any order.

### Per-tick update (apply in this exact order)
For each tick `1..T`:
1. **Integrate** every circle with explicit Euler: `x += vx*DT`, `y += vy*DT`.
2. **Walls** (resolve the x-axis first, then the y-axis). Left: if `x - r < 0`, set `x = r` and, if `vx < 0`, set `vx = -vx*E`. Right: if `x + r > W`, set `x = W - r` and, if `vx > 0`, set `vx = -vx*E`. Bottom: if `y - r < 0`, set `y = r` and, if `vy < 0`, set `vy = -vy*E`. Top: if `y + r > H`, set `y = H - r` and, if `vy > 0`, set `vy = -vy*E`.
3. **Rebuild the spatial hash** from the current positions. A circle is inserted into every cell that its axis-aligned bounding box `[x-r, x+r] x [y-r, y+r]` overlaps. The cell containing a point `(px,py)` has integer coordinates `(floor(px/C), floor(py/C))`.
4. **Broad phase + narrow phase (detection).** A *candidate pair* is any pair of two distinct circles that share at least one cell. Each candidate pair must be narrow-phase tested **exactly once** (deduplicated across shared cells). Two circles collide if and only if the distance between their centers is strictly less than the sum of their radii. Record the set of colliding pairs and the total number of narrow-phase checks performed this tick (which equals the number of distinct candidate pairs). Detection uses the positions and velocities produced by steps 1-2 as a frozen snapshot; the resolution in step 5 must not change which pairs are detected this tick.
5. **Resolution.** Process the colliding pairs detected in step 4 in ascending order of `(min id, max id)`. Each circle's mass equals `r*r`. For a pair `(a,b)`, using their current centers, let `d` be the center distance and `n` the unit vector pointing from `a` to `b` (if `d == 0`, use `n = (1,0)` and treat the overlap as `ra+rb`):
   - **Positional correction:** with `overlap = (ra+rb) - d`, move `a` by `-(overlap/2)*n` and move `b` by `+(overlap/2)*n`.
   - **Velocity impulse:** let `vn` be the dot product of `(va - vb)` with `n`. If `vn > 0`, compute `j = (1+E)*vn / (1/ma + 1/mb)`, then set `va = va - (j/ma)*n` and `vb = vb + (j/mb)*n`. If `vn <= 0`, leave the velocities unchanged.
   Positional correction may push a circle outside the walls; do **not** re-clamp to the walls during or after resolution. Walls are handled only in step 2 of the next tick.

### Output file format
Write to the output file one block per checkpoint, in ascending checkpoint-tick order, with no extra text. For a checkpoint at tick `t` the block is:
```
TICK <t>
CHECKS <c>
COLLISIONS <m>
<i> <j>
CIRCLES <n>
<id> <x> <y> <vx> <vy>
```
There are `m` colliding-pair lines, each printed as two ids with `i < j`, sorted ascending by `i` then by `j`. There are `n` circle lines, sorted ascending by `id`. `CHECKS`, `COLLISIONS`, `CIRCLES`, the ids, and the counts are integers. `CHECKS` is the value recorded in step 4 of that tick and the colliding-pairs set is the one from step 4, while the circle positions and velocities are their values after step 5 of that tick. Format `x`, `y`, `vx`, and `vy` with exactly 5 digits after the decimal point, using `.` as the decimal separator (US locale).

## Implementation Hints
- Project path: `/home/user/project`
- The application MUST run under `HeadlessApplication` (the headless backend) and MUST NOT make any OpenGL / `Gdx.gl*` calls.
- Run command (executed from the project root): `./gradlew --no-daemon --console=plain run --args="<input_file> <output_file>"`. The first argument is the input file path to read; the second is the output file path to write. The process must finish the simulation, write the file, and exit on its own.
- Use libGDX `1.14.2` and resolve `gdx`, `gdx-backend-headless`, and `gdx-platform:natives-desktop` from the local cache only.
- Write only the checkpoint blocks described above to the output file, and nothing else.

