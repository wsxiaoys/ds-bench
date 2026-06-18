# Deterministic Ashley ECS Simulation on the libGDX Headless Backend

## Background
libGDX ships a non-rendering **headless backend** (`gdx-backend-headless`) intended for servers, CI runs, and unit tests. The official **Ashley** extension is a pure-Java ECS library (no native dependencies) that pairs naturally with the headless backend because it never touches `Gdx.gl*`.

You must build a small command-line program that boots an Ashley-powered libGDX game under `HeadlessApplication`, loads a scenario file describing initial entities, advances the ECS engine by the requested number of ticks with a deterministic fixed time step, and prints the final state of every entity to stdout.

## Requirements
- Implement a Gradle project that depends on:
  - `com.badlogicgames.gdx:gdx:1.13.1`
  - `com.badlogicgames.gdx:gdx-backend-headless:1.13.1`
  - `com.badlogicgames.gdx:gdx-platform:1.13.1:natives-desktop`
  - `com.badlogicgames.ashley:ashley:1.7.4`
- Implement an `ApplicationListener` that:
  - Creates an Ashley `Engine` with **at least two** `Component` types: a position component (fields `x`, `y`) and a velocity component (fields `x`, `y`).
  - Registers an `EntitySystem` that advances every entity matching `Family.all(Position, Velocity)` by `position += velocity * dt` on each engine update.
  - Loads a scenario text file (see format below), creates one Ashley `Entity` per line, and adds it to the `Engine`.
  - On each `render()` call, advances the `Engine` exactly once with a **fixed** `deltaTime` of `1.0 / 60.0` seconds (do **not** read `Gdx.graphics.getDeltaTime()` — the headless `MockGraphics` is not reliable enough for the determinism this task requires).
  - After exactly `TICKS` `render()` calls have been processed, writes the final state to stdout in the format below and exits the headless application.
- Run the program under `HeadlessApplication` (configure `updatesPerSecond = 60`) and **wait for the headless main loop thread to finish** before the JVM exits, so the stdout output is complete and reproducible.
- Provide a shell entry point at `/home/user/gdx-ecs/run.sh` that accepts the scenario file as its first positional argument and prints **only** the simulation output to stdout (Gradle progress noise, log lines, and any other stderr/stdout chatter must not appear on stdout). Suggested approach: run the Gradle build in quiet mode (`-q`) and route everything except the final program output to stderr or `/dev/null`.

## Scenario File Format
A plain UTF-8 text file. Lines starting with `#` and blank lines must be ignored. The remaining lines, in any order, are:
- Exactly **one** `TICKS <n>` line where `<n>` is a non-negative integer.
- Zero or more `ENTITY <id> <x> <y> <vx> <vy>` lines where `<id>` is `[A-Za-z0-9_]+` and the four numbers are decimal floats.

Example:
```
# bouncing demo
TICKS 60
ENTITY A 0.0 0.0 1.0 0.5
ENTITY B 10.0 -5.0 -2.0 3.0
```

## Output Format
The program must write exactly the following lines to stdout, in this order, terminated by `\n`:
```
TICK_COUNT <ticks>
ENTITY <id> x=<x> y=<y>
... one ENTITY line per entity, in the same order they appear in the scenario file ...
```
- `<ticks>` is the integer from the `TICKS` line.
- `<x>` and `<y>` are the entity's final position, formatted with **exactly three decimals** using the `Locale.ROOT` / `%.3f` convention (e.g. `2.000`, `-30.000`, `0.500`). Use `-0.000` only if the underlying value really is negative zero; otherwise emit `0.000`.
- No additional lines, no leading/trailing whitespace, no ANSI codes.

## Implementation Hints
- Use the `HeadlessApplication(ApplicationListener, HeadlessApplicationConfiguration)` constructor and set `config.updatesPerSecond = 60`. Remember the headless main loop runs on its own thread — capture that thread (e.g. via `Thread.getAllStackTraces().keySet()` filtered by name `HeadlessApplication`, or by exposing it through reflection / a custom field) and `join()` it from `main` before returning.
- Call `Gdx.app.exit()` from inside `render()` once you have processed the configured number of ticks; the headless `exit()` schedules `running = false` via a posted runnable, so cleanup happens asynchronously.
- Ashley's `Engine.update(float deltaTime)` ticks every registered `EntitySystem` in priority order. You only need one custom system for movement.
- The scenario file can live anywhere on disk; using `Gdx.files.absolute(path)` keeps things simple under headless.
- Be careful about ordering: collect entities in a list (in input order) so you can print them in the order they were declared.
- Numbers must be formatted with `Locale.ROOT` to avoid `,` decimal separators in environments with non-English locales.

## Acceptance Criteria
- Project path: `/home/user/gdx-ecs`
- Command: `bash /home/user/gdx-ecs/run.sh <scenario_path>`
- Input argument: a path to a scenario file in the format described above.
- The command must exit with status `0` on valid input.
- The stdout (excluding stderr) must contain **only** the lines described in the Output Format section, in the order specified.
- The scenario `TICKS 0` must leave every entity at its initial position (formatted to three decimals).
- A scenario with no `ENTITY` lines must still emit the `TICK_COUNT <n>` line and nothing else.
- The simulation must use the Ashley ECS extension (`com.badlogicgames.ashley:ashley`) — at least one custom `Component` class and one custom `EntitySystem` subclass must be present in the source tree under `/home/user/gdx-ecs`.
- The simulation must run under the libGDX **headless** backend (`com.badlogicgames.gdx:gdx-backend-headless`) — the LWJGL3 / desktop GL backends must not be on the runtime classpath.

