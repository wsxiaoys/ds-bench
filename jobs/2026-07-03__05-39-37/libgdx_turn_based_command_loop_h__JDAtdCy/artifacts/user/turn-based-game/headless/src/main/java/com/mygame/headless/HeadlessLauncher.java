package com.mygame.headless;

import java.lang.reflect.Field;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import com.mygame.core.GameCore;
import com.mygame.core.ScriptedInput;

/**
 * Boots the deterministic game core on the libGDX headless backend (no GPU, no
 * window) so it can run in a server / CI context.
 *
 * <p>Accepts three CLI arguments in any order:</p>
 * <ul>
 *   <li>{@code --map=<absolute_path>}</li>
 *   <li>{@code --commands=<absolute_path>}</li>
 *   <li>{@code --transcript=<absolute_path>}</li>
 * </ul>
 */
public class HeadlessLauncher {

    public static void main(String[] args) throws Exception {
        String mapPath = null;
        String commandsPath = null;
        String transcriptPath = null;

        for (String arg : args) {
            if (arg.startsWith("--map=")) {
                mapPath = arg.substring("--map=".length());
            } else if (arg.startsWith("--commands=")) {
                commandsPath = arg.substring("--commands=".length());
            } else if (arg.startsWith("--transcript=")) {
                transcriptPath = arg.substring("--transcript=".length());
            }
        }

        if (mapPath == null) {
            throw new IllegalArgumentException("Missing required argument --map=<absolute_path>");
        }
        if (commandsPath == null) {
            throw new IllegalArgumentException("Missing required argument --commands=<absolute_path>");
        }
        if (transcriptPath == null) {
            throw new IllegalArgumentException("Missing required argument --transcript=<absolute_path>");
        }

        // Build the scripted input and the game core before starting the
        // headless application so the listener always has a ready input source
        // (the headless main-loop thread starts inside the HeadlessApplication
        // constructor, so we must not depend on Gdx.input being swapped yet).
        ScriptedInput scriptedInput = new ScriptedInput();
        GameCore game = new GameCore(scriptedInput, mapPath, commandsPath, transcriptPath);

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        // 0 => never sleep, run the loop as fast as possible (one turn per tick).
        config.updatesPerSecond = 0;

        HeadlessApplication app = new HeadlessApplication(game, config);

        // Right after construction Gdx.input is a vanilla MockInput; swap it for
        // our scripted subclass before the loop makes further progress.
        Gdx.input = scriptedInput;

        // Wait for the headless main-loop thread to finish so the transcript is
        // fully written by the time the process exits.
        Field field = HeadlessApplication.class.getDeclaredField("mainLoopThread");
        field.setAccessible(true);
        Thread mainLoopThread = (Thread) field.get(app);
        mainLoopThread.join();
    }
}