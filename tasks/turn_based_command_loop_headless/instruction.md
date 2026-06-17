# Headless libGDX Turn-Based Command Loop

## Background
You are building the deterministic core of a tiny dungeon-crawler that runs entirely on the libGDX **headless** backend (no GPU, no window). The same engine will later be reused inside the LWJGL3 desktop client, but for this task it must run in a server / CI context. The game advances one *turn* per render tick, consuming a single command from a script file, mutating its in-memory world, and appending a single transcript line per turn.

libGDX is a Java game framework. The `gdx-backend-headless` module ships `HeadlessApplication`, `HeadlessFiles`, `MockGraphics`, `MockAudio`, and `MockInput` so the rest of the library works without OpenGL. You will rely on this backend together with `Gdx.files`, `Gdx.app`, an `ApplicationListener`, and a custom `MockInput` subclass.

## Requirements
- Set up a multi-module Gradle project with at least:
  - a shared `core` module that contains the `ApplicationListener` (game logic) and the `MockInput` subclass,
  - a `headless` module whose `main(String[])` boots a `HeadlessApplication` and wires up command-file input.
- Pin `gdxVersion = 1.14.2` and depend on `com.badlogicgames.gdx:gdx`, `com.badlogicgames.gdx:gdx-backend-headless`, and `com.badlogicgames.gdx:gdx-platform:...:natives-desktop`.
- The headless launcher must accept three CLI arguments (any order):
  - `--map=<absolute_path>`
  - `--commands=<absolute_path>`
  - `--transcript=<absolute_path>`
- The map file uses this UTF-8 text format (whitespace-separated tokens, `#` lines and blank lines ignored):
  ```
  <WIDTH> <HEIGHT>
  <PLAYER_X> <PLAYER_Y>
  <ITEM_COUNT>
  <X1> <Y1> <NAME1>
  <X2> <Y2> <NAME2>
  ...
  ```
  Coordinates use the origin at the lower-left: x grows east, y grows north. Item names are single tokens (no spaces).
- The commands file holds one command per line. Valid commands (case-sensitive):
  - `N` / `S` / `E` / `W` — move the player one cell north / south / east / west.
  - `PICK` — pick up exactly one item located at the player's current cell (if multiple, the one defined earliest in the map file; if none, no-op).
  - `QUIT` — stop the loop after recording this turn.
  - Any other non-empty, non-blank token is an *unknown* command. Trim each line; ignore blank lines and lines starting with `#`.
- Movement that would leave the map (`x` outside `[0, WIDTH)` or `y` outside `[0, HEIGHT)`) is rejected: the player stays in place but the turn still counts.
- A picked-up item is removed from the world; subsequent `PICK` calls on the same cell only succeed if another item was defined there.
- The transcript file must be created (overwriting any pre-existing file) and contain one line per executed turn, terminated by a single `FINAL` line:
  - Per-turn format (no extra spaces, exact tokens):
    ```
    turn=<N> cmd=<RAW_COMMAND> pos=<X>,<Y> inv=<NAMES>
    ```
    where `<N>` starts at 1 and increments by one per turn, `<RAW_COMMAND>` is the original (trimmed) token from the command file, `<X>,<Y>` is the player's position **after** the command resolves, and `<NAMES>` is the inventory rendered as a comma-separated list of item names in pickup order (empty string if the inventory is empty, e.g. `inv=`).
  - Final line format (after the last turn):
    ```
    FINAL pos=<X>,<Y> inv=<NAMES> turns=<TOTAL_TURNS>
    ```
- The loop ends when **either** a `QUIT` command has just been recorded, **or** the command file is exhausted. In both cases the program must call `Gdx.app.exit()`, flush the transcript, and let the JVM terminate cleanly with exit code `0`.
- Input must be delivered to the game via a custom subclass of `com.badlogic.gdx.backends.headless.mock.input.MockInput`. The subclass must hold the queued commands derived from the input file and, each tick, expose the *current* command to the listener via `isKeyJustPressed(int)` / `isKeyPressed(int)`. Replace `Gdx.input` with this subclass right after constructing the `HeadlessApplication`.
- The mapping from command to libGDX keycode (`com.badlogic.gdx.Input.Keys`) must be:
  - `N` → `Input.Keys.UP`
  - `S` → `Input.Keys.DOWN`
  - `E` → `Input.Keys.RIGHT`
  - `W` → `Input.Keys.LEFT`
  - `PICK` → `Input.Keys.SPACE`
  - `QUIT` → `Input.Keys.ESCAPE`
  - any other command → no keycode active for this tick (the game still records the raw command in the transcript without changing state).
- The map file is read with `Gdx.files.absolute(...)`. The transcript is written using `Gdx.files.absolute(...).writeString(...)` (or any equivalent libGDX `FileHandle` API).
- The headless `HeadlessApplicationConfiguration.updatesPerSecond` should be set so the loop runs as fast as possible (you may use `0` for unlimited, or a high value such as `1000`).
- The launcher main thread must wait for the headless main-loop thread to finish before returning, so the transcript is fully written by the time the process exits.

## Implementation Hints
- The headless backend can be started with `new HeadlessApplication(listener, config)`. Right after construction, `Gdx.input` is a vanilla `MockInput`; swap it for your scripted subclass before the first render tick fires.
- Keep all OpenGL-touching APIs (`SpriteBatch`, `Texture`, `Gdx.gl*`, etc.) out of the project — the headless backend will NPE if they are invoked.
- A simple way to advance one command per tick is to have the scripted `MockInput` expose a `tick()` method (or equivalent) and call it from the start of `ApplicationListener.render()` before reading `isKeyJustPressed`.
- Remember to handle the `QUIT` command *after* writing its transcript line, so the FINAL line reflects the state at the moment of quitting.
- `Gdx.files.absolute(path)` returns a `FileHandle` suitable for both reading and writing; for the transcript prefer a single `writeString(..., false)` call (or buffered append) so partial writes are not visible to the verifier.

## Acceptance Criteria
- Project path: `/home/user/turn-based-game`
- Command: `./gradlew --no-daemon -q :headless:run --args="--map=<MAP> --commands=<COMMANDS> --transcript=<TRANSCRIPT>"` (run from the project root, with absolute paths for all three arguments)
- Exit code: `0`
- The transcript file at the supplied `--transcript` path must:
  - exist after the command completes,
  - contain exactly `T + 1` lines, where `T` is the number of executed turns,
  - have one `turn=<N> cmd=<RAW> pos=<X>,<Y> inv=<NAMES>` line per turn in execution order,
  - end with a single `FINAL pos=<X>,<Y> inv=<NAMES> turns=<T>` line,
  - use exactly the field separators specified above (single spaces between fields, no trailing spaces, LF line endings).
- The headless backend (`gdx-backend-headless`) must be on the runtime classpath of the `:headless` module.
- The game's input must flow through a subclass of `com.badlogic.gdx.backends.headless.mock.input.MockInput`. (Verified indirectly via behavior: only the documented keycodes must drive state changes, while non-mapped commands must leave position and inventory unchanged.)

