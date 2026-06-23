# Procedural Pixmap Renderer with libGDX Headless Backend

## Background
libGDX exposes a CPU-side image type called `Pixmap` plus a small writer called `PixmapIO` that can emit uncompressed PNG files. Combined with the `gdx-backend-headless` back-end, these primitives can run inside a CI job, a server process, or a unit test — no OpenGL context is required as long as the code never touches `Gdx.gl*`.

Your job is to build a small, reproducible command-line tool that boots a `HeadlessApplication`, draws a procedural image into a `Pixmap` based on a text command script, and writes the result to a PNG file using `PixmapIO.writePNG`.

## Requirements
- Implement a Gradle-based Java project that depends on `com.badlogicgames.gdx:gdx:1.14.2`, `com.badlogicgames.gdx:gdx-backend-headless:1.14.2`, and the desktop natives classifier `com.badlogicgames.gdx:gdx-platform:1.14.2:natives-desktop`.
- Provide an `ApplicationListener` (e.g., extending `ApplicationAdapter`) that is started by a `HeadlessApplication` and performs all rendering and file I/O work inside the libGDX life-cycle (not from `main` directly).
- Read a plain-text command script (referred to as the *input file*) and execute its drawing commands against a single `Pixmap`. The script has one command per line; tokens are whitespace separated; blank lines and lines starting with `#` are ignored. Supported commands are:
  - `SIZE <width> <height>` — must be the first non-comment, non-blank line. Allocates a `Pixmap` of the given dimensions in `RGBA8888` format. The width and height are positive integers.
  - `FILL <r> <g> <b> <a>` — sets the current color from the 0–255 components and fills the entire pixmap with it.
  - `RECT <x> <y> <w> <h> <r> <g> <b> <a>` — sets the color and draws a filled axis-aligned rectangle with the libGDX `fillRectangle` helper.
  - `LINE <x1> <y1> <x2> <y2> <r> <g> <b> <a>` — sets the color and draws a 1-pixel-wide line using `drawLine`.
  - `CIRCLE <cx> <cy> <radius> <r> <g> <b> <a>` — sets the color and draws a filled circle with `fillCircle`.
  - `PIXEL <x> <y> <r> <g> <b> <a>` — sets the color and writes a single pixel via `drawPixel`.
- Write the final pixmap to the requested output path as a PNG using `PixmapIO.writePNG`. The output path is taken from the second CLI argument.
- After the headless run finishes, print exactly one summary line to stdout in the format `RENDER_OK width=<w> height=<h> commands=<n>`, where `<n>` is the number of drawing commands processed (excluding `SIZE`, comments, and blank lines).
- Expose a single shell entrypoint `run.sh` at the project root that accepts two positional arguments — the input command file and the output PNG path — and runs the headless launcher with them. The Docker image already provides every libGDX dependency in the local Gradle cache, so the script can (and should) run Gradle with `--offline` for speed.

## Implementation Hints
- Boot libGDX with `new HeadlessApplication(listener, config)` where `config` is a `HeadlessApplicationConfiguration` — the headless back-end automatically calls `HeadlessNativesLoader.load()` so `Pixmap` and `PixmapIO` are usable.
- All Pixmap work and the `PixmapIO.writePNG` call must happen on the libGDX thread (e.g., inside `create()` or via `Gdx.app.postRunnable`). After the work is queued/finished, call `Gdx.app.exit()` and `join()` the application thread before exiting `main`, otherwise the JVM may print the summary before the file is flushed.
- `Pixmap.setColor(r, g, b, a)` expects normalized floats in `[0, 1]`; the input file provides integer 0–255 values, so convert them before calling `setColor`.
- Resolve the input/output paths with `Gdx.files.absolute(...)` (or `Gdx.files.local(...)`) and pass the resulting `FileHandle` to `PixmapIO.writePNG`.
- Configure the Gradle build to produce a fat/runnable JAR or to be invokable via `./gradlew --no-daemon --offline run --args="..."`; `run.sh` can dispatch to whichever you choose as long as the two positional arguments are forwarded correctly.
- Always `dispose()` the `Pixmap` and let `HeadlessApplication` shut down cleanly so the PNG bytes are fully written.

## Acceptance Criteria
- Project path: /home/user/pixmap-renderer
- Command: `bash run.sh <input_file> <output_png>` (must be runnable from `/home/user/pixmap-renderer`).
- The command must boot the libGDX headless back-end and execute all draw commands through `Pixmap` / `PixmapIO` (no separate image-processing library).
- After a successful run:
  - A valid PNG file must exist at the path passed as the second argument.
  - The PNG dimensions must equal the `width` and `height` from the `SIZE` directive in the input file.
  - The pixel data must reflect the drawing commands executed in script order (later commands overwrite earlier ones).
  - The process must print exactly one line to stdout matching the regex `^RENDER_OK width=\d+ height=\d+ commands=\d+$`, where `commands` equals the number of drawing commands processed (excluding `SIZE`, comments, and blank lines).
  - The process must exit with status code `0`.
- The Gradle build must declare `com.badlogicgames.gdx:gdx:1.14.2`, `com.badlogicgames.gdx:gdx-backend-headless:1.14.2`, and the `natives-desktop` classifier of `com.badlogicgames.gdx:gdx-platform:1.14.2` (as a `runtimeOnly` or equivalent configuration).
- The Docker image already pre-populates the Gradle cache at `/home/user/.gradle` with the libGDX artifacts, so the build can run with `gradle --offline` for fast, deterministic dependency resolution.

