package com.example.sim;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import com.badlogic.gdx.scenes.scene2d.Actor;
import com.badlogic.gdx.scenes.scene2d.actions.Actions;

import java.io.BufferedWriter;
import java.io.FileOutputStream;
import java.io.OutputStreamWriter;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Entry-point for the Scene2D headless action-replay simulator.
 *
 * Usage:
 *   ./gradlew --no-daemon -q run --args="&lt;script-path&gt; &lt;output-path&gt;"
 *
 * The program:
 *  1. Parses a plain-text script that declares actors and MoveByActions.
 *  2. Boots a HeadlessApplication that advances every actor's action queue
 *     by a fixed dt for the requested number of ticks.
 *  3. Writes each actor's final position to the output file, then exits.
 */
public class Main {

    // -----------------------------------------------------------------------
    // Script data holders (parsed before the HeadlessApplication starts)
    // -----------------------------------------------------------------------

    /** Parsed directive: actor &lt;id&gt; &lt;x&gt; &lt;y&gt; */
    static final class ActorSpec {
        final String id;
        final float x, y;
        ActorSpec(String id, float x, float y) {
            this.id = id;
            this.x = x;
            this.y = y;
        }
    }

    /** Parsed directive: moveby &lt;id&gt; &lt;dx&gt; &lt;dy&gt; &lt;duration&gt; */
    static final class MoveBySpec {
        final String id;
        final float dx, dy, duration;
        MoveBySpec(String id, float dx, float dy, float duration) {
            this.id = id;
            this.dx = dx;
            this.dy = dy;
            this.duration = duration;
        }
    }

    /** Full parsed script. */
    static final class Script {
        float dt;
        int ticks;
        /** Ordered list of actor declarations (defines output order). */
        final List<ActorSpec> actors = new ArrayList<>();
        /** At most one moveby per actor id. */
        final Map<String, MoveBySpec> moveBys = new LinkedHashMap<>();
    }

    // -----------------------------------------------------------------------
    // ApplicationListener  (all Scene2D logic lives here)
    // -----------------------------------------------------------------------

    static final class SimListener extends ApplicationAdapter {

        private final Script script;
        private final String outputPath;

        /** Ordered list of live Actor objects. */
        private final List<Actor> actorList = new ArrayList<>();
        /** id -> Actor, same insertion order as actorList. */
        private final Map<String, Actor> actorMap = new LinkedHashMap<>();

        private int ticksRemaining;

        SimListener(Script script, String outputPath) {
            this.script = script;
            this.outputPath = outputPath;
        }

        // -------------------------------------------------------------------
        // ApplicationAdapter overrides
        // -------------------------------------------------------------------

        @Override
        public void create() {
            // Build Actor instances from the parsed specs.
            for (ActorSpec spec : script.actors) {
                Actor actor = new Actor();
                actor.setName(spec.id);
                actor.setPosition(spec.x, spec.y);
                actorList.add(actor);
                actorMap.put(spec.id, actor);
            }

            // Queue MoveByActions on the relevant actors.
            // Actions.moveBy(dx, dy, duration) uses linear interpolation by default.
            for (MoveBySpec mb : script.moveBys.values()) {
                Actor actor = actorMap.get(mb.id);
                if (actor != null) {
                    actor.addAction(Actions.moveBy(mb.dx, mb.dy, mb.duration));
                }
            }

            ticksRemaining = script.ticks;
        }

        @Override
        public void render() {
            if (ticksRemaining > 0) {
                // Advance every actor's action queue by the fixed, deterministic dt.
                // We do NOT call Gdx.graphics.getDeltaTime() -- that would couple the
                // simulation to wall-clock time and break determinism.
                for (Actor actor : actorList) {
                    actor.act(script.dt);
                }
                ticksRemaining--;
            }

            if (ticksRemaining == 0) {
                // All ticks done (also handles the ticks=0 case).
                // Signal the headless loop to stop; dispose() will write output.
                Gdx.app.exit();
                // Move past zero so we don't call exit() on every subsequent
                // render() call if the loop squeezes in more iterations.
                ticksRemaining = -1;
            }
        }

        @Override
        public void dispose() {
            // Write the output file.  dispose() is called by the headless-loop
            // thread just before it terminates, so the file is guaranteed to be
            // flushed before main()'s join() returns.
            try {
                StringBuilder sb = new StringBuilder();
                for (Actor actor : actorList) {
                    sb.append(actor.getName())
                      .append('=')
                      .append(String.format(Locale.ROOT, "%.6f", actor.getX()))
                      .append(',')
                      .append(String.format(Locale.ROOT, "%.6f", actor.getY()))
                      .append('\n');
                }

                try (BufferedWriter bw = new BufferedWriter(
                        new OutputStreamWriter(
                                new FileOutputStream(outputPath, false),
                                StandardCharsets.UTF_8))) {
                    bw.write(sb.toString());
                }
            } catch (Exception e) {
                System.err.println("ERROR writing output file: " + e.getMessage());
                e.printStackTrace();
            }
        }
    }

    // -----------------------------------------------------------------------
    // Script parser
    // -----------------------------------------------------------------------

    static Script parseScript(String path) throws Exception {
        Script script = new Script();
        boolean dtSet = false;
        boolean ticksSet = false;

        List<String> lines = Files.readAllLines(Paths.get(path), StandardCharsets.UTF_8);
        int lineNo = 0;
        for (String raw : lines) {
            lineNo++;
            String line = raw.strip();
            if (line.isEmpty() || line.startsWith("#")) {
                continue;
            }

            // Split on one or more spaces/tabs.
            String[] tokens = line.split("[ \\t]+");
            if (tokens.length == 0) {
                continue;
            }

            String directive = tokens[0].toLowerCase(Locale.ROOT);

            switch (directive) {

                case "dt": {
                    if (tokens.length != 2) {
                        throw new IllegalArgumentException(
                            "Line " + lineNo + ": 'dt' requires exactly 1 argument");
                    }
                    script.dt = Float.parseFloat(tokens[1]);
                    if (script.dt <= 0) {
                        throw new IllegalArgumentException(
                            "Line " + lineNo + ": 'dt' must be > 0");
                    }
                    dtSet = true;
                    break;
                }

                case "ticks": {
                    if (tokens.length != 2) {
                        throw new IllegalArgumentException(
                            "Line " + lineNo + ": 'ticks' requires exactly 1 argument");
                    }
                    script.ticks = Integer.parseInt(tokens[1]);
                    if (script.ticks < 0) {
                        throw new IllegalArgumentException(
                            "Line " + lineNo + ": 'ticks' must be >= 0");
                    }
                    ticksSet = true;
                    break;
                }

                case "actor": {
                    if (!dtSet || !ticksSet) {
                        throw new IllegalArgumentException(
                            "Line " + lineNo + ": 'actor' must appear after 'dt' and 'ticks'");
                    }
                    if (tokens.length != 4) {
                        throw new IllegalArgumentException(
                            "Line " + lineNo + ": 'actor' requires exactly 3 arguments (id x y)");
                    }
                    String id = tokens[1];
                    float x = Float.parseFloat(tokens[2]);
                    float y = Float.parseFloat(tokens[3]);
                    for (ActorSpec existing : script.actors) {
                        if (existing.id.equals(id)) {
                            throw new IllegalArgumentException(
                                "Line " + lineNo + ": duplicate actor id '" + id + "'");
                        }
                    }
                    script.actors.add(new ActorSpec(id, x, y));
                    break;
                }

                case "moveby": {
                    if (!dtSet || !ticksSet) {
                        throw new IllegalArgumentException(
                            "Line " + lineNo + ": 'moveby' must appear after 'dt' and 'ticks'");
                    }
                    if (tokens.length != 5) {
                        throw new IllegalArgumentException(
                            "Line " + lineNo
                            + ": 'moveby' requires exactly 4 arguments (id dx dy duration)");
                    }
                    String id = tokens[1];
                    float dx = Float.parseFloat(tokens[2]);
                    float dy = Float.parseFloat(tokens[3]);
                    float duration = Float.parseFloat(tokens[4]);
                    if (duration < 0) {
                        throw new IllegalArgumentException(
                            "Line " + lineNo + ": 'moveby' duration must be >= 0");
                    }
                    if (script.moveBys.containsKey(id)) {
                        throw new IllegalArgumentException(
                            "Line " + lineNo
                            + ": duplicate moveby for actor '" + id + "'");
                    }
                    boolean found = false;
                    for (ActorSpec a : script.actors) {
                        if (a.id.equals(id)) { found = true; break; }
                    }
                    if (!found) {
                        throw new IllegalArgumentException(
                            "Line " + lineNo
                            + ": moveby targets undeclared actor '" + id + "'");
                    }
                    script.moveBys.put(id, new MoveBySpec(id, dx, dy, duration));
                    break;
                }

                default:
                    throw new IllegalArgumentException(
                        "Line " + lineNo + ": unknown directive '" + directive + "'");
            }
        }

        if (!dtSet)    throw new IllegalArgumentException("Script is missing required 'dt' directive");
        if (!ticksSet) throw new IllegalArgumentException("Script is missing required 'ticks' directive");

        return script;
    }

    // -----------------------------------------------------------------------
    // main
    // -----------------------------------------------------------------------

    public static void main(String[] args) throws Exception {
        if (args.length != 2) {
            System.err.println("Usage: gdx-stage-sim <script-path> <output-path>");
            System.exit(1);
        }

        String scriptPath = args[0];
        String outputPath = args[1];

        // Parse the script before starting the headless application so that
        // any parse errors are reported immediately, without spinning up libGDX.
        Script script = parseScript(scriptPath);

        // Configure the headless backend.
        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        // updatesPerSecond = 0: loop as fast as possible (no wall-clock throttle).
        config.updatesPerSecond = 0;

        SimListener listener = new SimListener(script, outputPath);

        // Start the headless application.  The constructor launches an internal
        // thread (mainLoopThread) that calls create() -> render()* -> dispose().
        HeadlessApplication app = new HeadlessApplication(listener, config);

        // HeadlessApplication does not extend Thread itself; it holds a
        // protected field `mainLoopThread`.  We obtain it via reflection and
        // join() it so that main() blocks until dispose() has finished writing
        // the output file before the JVM exits.
        Thread mainLoopThread = getMainLoopThread(app);
        if (mainLoopThread != null) {
            mainLoopThread.join();
        }

        System.exit(0);
    }

    /**
     * Retrieves the internal {@code mainLoopThread} field from a
     * {@link HeadlessApplication} instance via reflection.
     *
     * @return the thread, or {@code null} if the field cannot be accessed.
     */
    private static Thread getMainLoopThread(HeadlessApplication app) {
        try {
            Field f = HeadlessApplication.class.getDeclaredField("mainLoopThread");
            f.setAccessible(true);
            return (Thread) f.get(app);
        } catch (Exception e) {
            System.err.println("WARNING: could not access mainLoopThread via reflection: "
                + e.getMessage());
            return null;
        }
    }
}
