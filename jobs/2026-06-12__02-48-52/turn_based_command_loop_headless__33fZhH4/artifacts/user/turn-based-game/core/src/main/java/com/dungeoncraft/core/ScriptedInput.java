package com.dungeoncraft.core;

import com.badlogic.gdx.Input;
import com.badlogic.gdx.backends.headless.mock.input.MockInput;

import java.util.List;

/**
 * A {@link MockInput} subclass that replays a pre-loaded list of command
 * strings, one per call to {@link #tick()}.
 *
 * <p>Each call to {@code tick()} advances the internal cursor and sets the
 * "active" keycode for the current command.  Subsequent calls to
 * {@link #isKeyJustPressed(int)} / {@link #isKeyPressed(int)} reflect that
 * keycode until the next {@code tick()}.
 *
 * <p>The command-to-keycode mapping is:
 * <pre>
 *   N    → {@link Input.Keys#UP}
 *   S    → {@link Input.Keys#DOWN}
 *   E    → {@link Input.Keys#RIGHT}
 *   W    → {@link Input.Keys#LEFT}
 *   PICK → {@link Input.Keys#SPACE}
 *   QUIT → {@link Input.Keys#ESCAPE}
 *   *    → -1 (no active key; unknown command)
 * </pre>
 */
public class ScriptedInput extends MockInput {

    /** Sentinel: no keycode active this tick. */
    public static final int NO_KEY = -1;

    private final List<String> commands;
    private int cursor = -1;         // points at the "current" command
    private int activeKeycode = NO_KEY;
    private String currentCommand = "";

    public ScriptedInput(List<String> commands) {
        this.commands = commands;
    }

    // ── lifecycle ─────────────────────────────────────────────────────────────

    /**
     * Advance to the next command.  Must be called exactly once at the start
     * of each {@code ApplicationListener.render()} frame before any key
     * queries are made.
     *
     * @return {@code true} if there is a command available after advancing;
     *         {@code false} if the command list is exhausted.
     */
    public boolean tick() {
        cursor++;
        if (cursor >= commands.size()) {
            activeKeycode  = NO_KEY;
            currentCommand = "";
            return false;
        }
        currentCommand = commands.get(cursor);
        activeKeycode  = toKeycode(currentCommand);
        return true;
    }

    /**
     * Returns the raw (trimmed) command string that was set by the most recent
     * {@link #tick()} call.  Empty string when exhausted.
     */
    public String getCurrentCommand() {
        return currentCommand;
    }

    /**
     * {@code true} when the command list has been fully consumed
     * (i.e. the last {@link #tick()} returned {@code false}).
     */
    public boolean isExhausted() {
        return cursor >= commands.size();
    }

    // ── MockInput overrides ───────────────────────────────────────────────────

    /**
     * Returns {@code true} when {@code keycode} matches the active keycode
     * for the current tick.  Mimics a "just pressed" event for one frame.
     */
    @Override
    public boolean isKeyJustPressed(int keycode) {
        return keycode != NO_KEY && keycode == activeKeycode;
    }

    /**
     * Returns {@code true} when {@code keycode} matches the active keycode
     * for the current tick.  Same semantics as {@link #isKeyJustPressed} in
     * this scripted context (no held-key distinction needed).
     */
    @Override
    public boolean isKeyPressed(int keycode) {
        return keycode != NO_KEY && keycode == activeKeycode;
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    /** Map a command token to the corresponding libGDX keycode. */
    public static int toKeycode(String command) {
        if (command == null) return NO_KEY;
        switch (command) {
            case "N":    return Input.Keys.UP;
            case "S":    return Input.Keys.DOWN;
            case "E":    return Input.Keys.RIGHT;
            case "W":    return Input.Keys.LEFT;
            case "PICK": return Input.Keys.SPACE;
            case "QUIT": return Input.Keys.ESCAPE;
            default:     return NO_KEY;
        }
    }
}
