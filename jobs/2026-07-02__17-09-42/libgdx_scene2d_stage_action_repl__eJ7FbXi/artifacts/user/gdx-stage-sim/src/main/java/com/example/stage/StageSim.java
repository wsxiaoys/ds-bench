package com.example.stage;

import com.badlogic.gdx.ApplicationListener;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import com.badlogic.gdx.scenes.scene2d.Actor;
import com.badlogic.gdx.scenes.scene2d.actions.MoveByAction;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Headless Scene2D action replay tool.
 *
 * <p>The entry point is {@link #main(String[])}. It boots a real
 * {@link HeadlessApplication} (which spins up the main-loop thread and
 * installs the {@code Gdx.*} mock singletons), drives an
 * {@link ApplicationListener} that loads a scene-graph description from a text
 * file, advances the queued Scene2D {@link com.badlogic.gdx.scenes.scene2d.Action
 * Actions} by a fixed time step on each render tick, and finally writes every
 * actor's last position to the output file.
 *
 * <p>The simulation step uses the {@code dt} value parsed from the script,
 * never {@code Gdx.graphics.getDeltaTime()}, so the replay is deterministic
 * and independent of wall-clock time. The output is written from
 * {@code dispose()}, after which the main thread joins the
 * {@code HeadlessApplication} main loop thread to guarantee the JVM does not
 * exit before the file is flushed.
 */
public final class StageSim {

    private StageSim() {
    }

    /**
     * Entry point. Expects two arguments:
     * <ol>
     *   <li>absolute or relative path to the scene script file;</li>
     *   <li>path of the file to write the final actor positions to.</li>
     * </ol>
     */
    public static void main(String[] args) {
        if (args.length != 2) {
            System.err.println("Usage: StageSim <script-path> <output-path>");
            System.exit(2);
            return;
        }

        final String scriptPath = args[0];
        final String outputPath = args[1];

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        // updatesPerSecond = 0 -> getTargetRenderInterval() returns 0, so the
        // main loop never sleeps and the simulation is not throttled by the
        // wall clock.
        config.updatesPerSecond = 0;

        ScriptListener listener = new ScriptListener(scriptPath, outputPath);
        ExposingHeadlessApplication app = new ExposingHeadlessApplication(listener, config);

        try {
            // Wait for the main loop thread to terminate. dispose() is
            // invoked synchronously from that thread just before it exits,
            // which guarantees the output file has been flushed.
            app.getMainLoopThread().join();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            System.err.println("StageSim interrupted while waiting for main loop");
            System.exit(3);
        }
    }

    /**
     * Tiny subclass of {@link HeadlessApplication} that simply exposes the
     * inherited, package-private {@code mainLoopThread} so the {@link #main}
     * method can join it. Everything else is delegated to the parent class.
     */
    static final class ExposingHeadlessApplication extends HeadlessApplication {

        ExposingHeadlessApplication(ApplicationListener listener,
                                   HeadlessApplicationConfiguration config) {
            super(listener, config);
        }

        Thread getMainLoopThread() {
            return mainLoopThread;
        }
    }

    /**
     * The Scene2D action-replay listener. Owns the parsed script state, the
     * list of actors, and the simulation clock.
     */
    static final class ScriptListener implements ApplicationListener {

        private static final Pattern ID_PATTERN = Pattern.compile("[A-Za-z0-9_]+");

        private final String scriptPath;
        private final String outputPath;

        // Simulation parameters (parsed in create()).
        private float dt = Float.NaN;
        private int ticks = -1;

        // Actors in declaration order. We keep both a LinkedHashMap (to look up
        // by id) and a parallel list (to iterate in declaration order for the
        // output file).
        private final Map<String, Actor> actors = new LinkedHashMap<>();
        private final List<String> declaredOrder = new ArrayList<>();

        // Tracks which ids already received a moveby directive so we can
        // detect duplicates per the spec.
        private final Set<String> movedActors = new LinkedHashSet<>();

        // Tick counter.
        private int currentTick = 0;

        ScriptListener(String scriptPath, String outputPath) {
            this.scriptPath = scriptPath;
            this.outputPath = outputPath;
        }

        @Override
        public void create() {
            // Use libGDX's file abstraction rather than java.io so we route
            // through the headless backend's HeadlessFiles (this also
            // exercises the API the task spec mentions).
            String content = Gdx.files.absolute(scriptPath).readString("UTF-8");
            parseScript(content);
        }

        /**
         * Parse the entire script into {@code dt}, {@code ticks}, the actor
         * set, and the queued actions.
         */
        private void parseScript(String content) {
            boolean dtSet = false;
            boolean ticksSet = false;

            // The spec lets dt and ticks appear in either order, but both
            // must come before any actor-related directive. We track them
            // with these flags.
            Set<String> knownActors = new LinkedHashSet<>();

            String[] lines = content.split("\\r?\\n", -1);
            for (int i = 0; i < lines.length; i++) {
                String rawLine = lines[i];
                String line = rawLine.trim();
                if (line.isEmpty() || line.startsWith("#")) {
                    continue;
                }
                String[] tokens = line.split("\\s+");
                if (tokens.length == 0 || tokens[0].isEmpty()) {
                    continue;
                }
                String directive = tokens[0].toLowerCase(Locale.ROOT);

                int lineNumber = i + 1;
                switch (directive) {
                    case "dt": {
                        requireTokens(tokens, 2, "dt", lineNumber);
                        if (dtSet) {
                            throw scriptError("duplicate 'dt' directive at line " + lineNumber);
                        }
                        float parsed;
                        try {
                            parsed = Float.parseFloat(tokens[1]);
                        } catch (NumberFormatException nfe) {
                            throw scriptError("invalid dt value '" + tokens[1] + "' at line " + lineNumber);
                        }
                        if (!(parsed > 0f) || Float.isInfinite(parsed) || Float.isNaN(parsed)) {
                            throw scriptError("dt must be > 0 at line " + lineNumber);
                        }
                        dt = parsed;
                        dtSet = true;
                        break;
                    }
                    case "ticks": {
                        requireTokens(tokens, 2, "ticks", lineNumber);
                        if (ticksSet) {
                            throw scriptError("duplicate 'ticks' directive at line " + lineNumber);
                        }
                        int parsed;
                        try {
                            parsed = Integer.parseInt(tokens[1]);
                        } catch (NumberFormatException nfe) {
                            throw scriptError("invalid ticks value '" + tokens[1] + "' at line " + lineNumber);
                        }
                        if (parsed < 0) {
                            throw scriptError("ticks must be >= 0 at line " + lineNumber);
                        }
                        ticks = parsed;
                        ticksSet = true;
                        break;
                    }
                    case "actor": {
                        requireTokens(tokens, 4, "actor", lineNumber);
                        if (!dtSet || !ticksSet) {
                            throw scriptError("'actor' directive at line " + lineNumber
                                    + " appears before dt/ticks are declared");
                        }
                        String id = tokens[1];
                        if (!ID_PATTERN.matcher(id).matches()) {
                            throw scriptError("invalid actor id '" + id + "' at line " + lineNumber);
                        }
                        if (!knownActors.add(id)) {
                            throw scriptError("duplicate actor id '" + id + "' at line " + lineNumber);
                        }
                        float x = parseFloat(tokens[2], "x", lineNumber);
                        float y = parseFloat(tokens[3], "y", lineNumber);
                        Actor actor = new Actor();
                        actor.setPosition(x, y);
                        actor.setName(id);
                        actors.put(id, actor);
                        declaredOrder.add(id);
                        break;
                    }
                    case "moveby": {
                        requireTokens(tokens, 5, "moveby", lineNumber);
                        if (!dtSet || !ticksSet) {
                            throw scriptError("'moveby' directive at line " + lineNumber
                                    + " appears before dt/ticks are declared");
                        }
                        String id = tokens[1];
                        if (!knownActors.contains(id)) {
                            throw scriptError("moveby for unknown actor '" + id + "' at line " + lineNumber);
                        }
                        if (!movedActors.add(id)) {
                            throw scriptError("duplicate moveby for actor '" + id + "' at line " + lineNumber);
                        }
                        float dx = parseFloat(tokens[2], "dx", lineNumber);
                        float dy = parseFloat(tokens[3], "dy", lineNumber);
                        float dur = parseFloat(tokens[4], "duration", lineNumber);
                        if (dur < 0f) {
                            throw scriptError("moveby duration must be >= 0 at line " + lineNumber);
                        }
                        MoveByAction action = new MoveByAction();
                        action.setAmount(dx, dy);
                        action.setDuration(dur);
                        // Default linear interpolation: do not call
                        // setInterpolation(...) so MoveByAction/TemporalAction
                        // use percent == time / duration, which is linear.
                        actors.get(id).addAction(action);
                        break;
                    }
                    default:
                        throw scriptError("unknown directive '" + tokens[0] + "' at line " + lineNumber);
                }
            }

            if (!dtSet) {
                throw scriptError("missing 'dt' directive");
            }
            if (!ticksSet) {
                throw scriptError("missing 'ticks' directive");
            }
        }

        private static void requireTokens(String[] tokens, int expected, String directive, int lineNumber) {
            if (tokens.length != expected) {
                throw scriptError("'" + directive + "' directive expects " + (expected - 1)
                        + " argument(s) at line " + lineNumber + " (got " + (tokens.length - 1) + ")");
            }
        }

        private static float parseFloat(String token, String name, int lineNumber) {
            try {
                float v = Float.parseFloat(token);
                if (Float.isNaN(v) || Float.isInfinite(v)) {
                    throw scriptError(name + " must be a finite number at line " + lineNumber);
                }
                return v;
            } catch (NumberFormatException nfe) {
                throw scriptError("invalid " + name + " value '" + token + "' at line " + lineNumber);
            }
        }

        private static IllegalArgumentException scriptError(String message) {
            return new IllegalArgumentException("StageSim script: " + message);
        }

        @Override
        public void render() {
            // Advance the scene-graph action queue by dt seconds for each
            // declared actor. We deliberately do not read
            // Gdx.graphics.getDeltaTime(): the simulation must be
            // deterministic and independent of wall-clock pacing.
            if (currentTick < ticks) {
                for (Actor actor : actors.values()) {
                    actor.act(dt);
                }
                currentTick++;
            }
            if (currentTick >= ticks) {
                // Asynchronous: posts a runnable that flips the running flag
                // so the main loop calls pause() + dispose() and exits.
                Gdx.app.exit();
            }
        }

        @Override
        public void resize(int width, int height) {
            // No-op: headless backend never invokes this with meaningful
            // values and we do not depend on window size.
        }

        @Override
        public void pause() {
            // No-op.
        }

        @Override
        public void resume() {
            // No-op.
        }

        @Override
        public void dispose() {
            // Called by the HeadlessApplication main loop thread just before
            // it exits. Writing the output here ensures the file is fully
            // flushed before main() returns and the JVM terminates.
            writeOutput();
        }

        /**
         * Serialise the final actor positions to {@link #outputPath}, one
         * {@code <id>=<x>,<y>} line per declared actor in declaration order.
         * Uses {@code Locale.ROOT} so the decimal separator is always '.'
         * and {@code %.6f} as specified.
         */
        private void writeOutput() {
            StringBuilder sb = new StringBuilder();
            for (String id : declaredOrder) {
                Actor actor = actors.get(id);
                sb.append(id).append('=')
                        .append(String.format(Locale.ROOT, "%.6f", actor.getX()))
                        .append(',')
                        .append(String.format(Locale.ROOT, "%.6f", actor.getY()))
                        .append('\n');
            }
            try {
                Path out = Paths.get(outputPath);
                if (out.getParent() != null) {
                    Files.createDirectories(out.getParent());
                }
                Files.write(out, sb.toString().getBytes(StandardCharsets.UTF_8));
            } catch (IOException ioe) {
                throw new RuntimeException("StageSim: failed to write output to '" + outputPath + "'", ioe);
            }
        }
    }
}