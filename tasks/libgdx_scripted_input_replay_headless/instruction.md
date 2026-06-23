# libGDX Headless: Scripted Keystroke Replay Walker

## Background
libGDX ships a non-rendering backend (`com.badlogicgames.gdx:gdx-backend-headless`) that swaps the live `Graphics`/`Input`/`Audio` implementations for mocks so that a libGDX `ApplicationListener` can be driven from a server, CI runner, or test harness. The bundled `MockInput` simply returns zero/`false` for every method, which makes it useless on its own for any input-driven game. A common pattern is to subclass `MockInput`, read a sequence of keystrokes from a text file, and re-dispatch them to the live `InputProcessor` each tick so that a deterministic replay of player input can drive the game from a script.

In this task you will build a small libGDX 1.14.2 project around the **headless** backend that simulates a 2D grid walker. The walker reads a keystroke replay file, advances one keystroke per render tick by feeding it through a custom `MockInput` subclass, and prints its final position once every scripted input has been consumed.

## Requirements
- Create a Gradle (Java 17) project at `/home/user/gdx-game` that depends on libGDX `1.14.2` (`gdx`, `gdx-backend-headless`, `gdx-platform:natives-desktop`).
- Implement a libGDX `ApplicationListener` (or `ApplicationAdapter`) that maintains a 2D integer walker position, starting at `(0, 0)`.
- Implement a custom `MockInput` subclass that reads a keystroke sequence from a text file and dispatches exactly one `InputProcessor.keyDown(keycode)` event per render tick. After the file is exhausted, the application must call `Gdx.app.exit()` so the headless main loop terminates cleanly.
- Drive position updates through libGDX's `InputProcessor` contract (i.e., the game must register an `InputProcessor` via `Gdx.input.setInputProcessor(...)`, and position updates happen inside that processor's callbacks).
- Produce a runnable launcher (using the Gradle `application` plugin) at `/home/user/gdx-game/build/install/gdx-game/bin/gdx-game` that accepts a `--input=<file>` argument and runs the simulation on a `HeadlessApplication`.
- Print the final walker position to stdout in the format `Final position: (<x>, <y>)`.

### Input file format
- UTF-8 text file.
- One keystroke per line. Lines are case-insensitive and trimmed of surrounding whitespace.
- Blank lines are skipped (no tick is consumed).
- Lines starting with `#` are treated as comments and skipped.
- Allowed keystroke names: `UP`, `DOWN`, `LEFT`, `RIGHT`. Any other non-blank/non-comment token must cause the program to print `Error: unknown key <token>` to stderr and exit with a non-zero status code (do **not** print a `Final position:` line in that case).

### Movement semantics
- `UP` increments y by 1.
- `DOWN` decrements y by 1.
- `RIGHT` increments x by 1.
- `LEFT` decrements x by 1.
- Each line consumes exactly one render tick. The position update **must** happen inside the registered `InputProcessor.keyDown(int keycode)` callback (use `com.badlogic.gdx.Input.Keys.UP|DOWN|LEFT|RIGHT`).

## Implementation Hints
- Pin `gdxVersion=1.14.2`. The required Maven coordinates and the headless backend recipe are summarised in the libGDX docs ([Dependency management with Gradle](https://libgdx.com/wiki/articles/dependency-management-with-gradle), [Headless backend source](https://github.com/libgdx/libgdx/blob/master/backends/gdx-backend-headless/src/com/badlogic/gdx/backends/headless/HeadlessApplication.java)).
- The Gradle `application` plugin gives you a turnkey launcher: configure `mainClass` and run `./gradlew installDist` to produce `build/install/<projectName>/bin/<projectName>`.
- `HeadlessApplication` runs the listener on its own thread, so block the launcher's `main` thread (e.g., by joining the headless main-loop thread) until the application has exited; otherwise the JVM may quit before the simulation finishes.
- `HeadlessApplication` constructs and assigns a no-op `MockInput` to `Gdx.input` in its constructor. After constructing the application, overwrite `Gdx.input` with your scripted subclass so that the rest of the framework sees it. Your subclass should remember the `InputProcessor` passed to `setInputProcessor(...)` and dispatch `keyDown` events from `render()` (via a `Gdx.app.postRunnable(...)` or directly from the simulation tick).
- Consider using `HeadlessApplicationConfiguration.updatesPerSecond` to throttle the loop so the test does not spin the CPU.
- The headless backend is sensitive to OpenGL calls — do **not** touch `Gdx.gl*` anywhere in your code.
- Bootstrap the Gradle wrapper with `gradle wrapper --gradle-version 8.10 --distribution-type bin` so reproducible builds are possible from the project root.

## Acceptance Criteria
- Project path: `/home/user/gdx-game`.
- After running `./gradlew --no-daemon --quiet installDist` from the project root, the launcher script `/home/user/gdx-game/build/install/gdx-game/bin/gdx-game` must exist and be executable.
- Command: `/home/user/gdx-game/build/install/gdx-game/bin/gdx-game --input=<path>`
- The command must accept the `--input=<path>` argument (equals form) where `<path>` is the absolute path to a keystroke replay file conforming to the format above.
- Successful runs (every line parses as a valid key) must:
  - Print exactly one line `Final position: (<x>, <y>)` to stdout (e.g., `Final position: (1, -2)`), where `<x>` and `<y>` are the final walker coordinates after processing every scripted keystroke.
  - Exit with status code `0`.
- Runs where any non-comment, non-blank line contains a token outside `{UP, DOWN, LEFT, RIGHT}` (case-insensitive) must:
  - Print `Error: unknown key <token>` to stderr (substituting the offending raw token verbatim).
  - Not print a `Final position:` line.
  - Exit with a non-zero status code.
- Empty replay files (no non-blank, non-comment lines) must print `Final position: (0, 0)` and exit `0`.
- The application must use `com.badlogic.gdx.backends.headless.HeadlessApplication` to boot the listener, and the position must be updated from within an `InputProcessor.keyDown(int)` callback registered via `Gdx.input.setInputProcessor(...)`. (This is verified indirectly through the behavioural tests above and through a build that links against `gdx-backend-headless:1.14.2`.)

