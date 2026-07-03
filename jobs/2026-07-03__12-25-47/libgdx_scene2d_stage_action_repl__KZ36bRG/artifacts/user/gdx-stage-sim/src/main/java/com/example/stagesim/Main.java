package com.example.stagesim;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import com.badlogic.gdx.files.FileHandle;
import com.badlogic.gdx.scenes.scene2d.Actor;
import com.badlogic.gdx.scenes.scene2d.actions.MoveByAction;

import java.io.BufferedWriter;
import java.io.FileWriter;
import java.io.IOException;
import java.io.PrintWriter;
import java.lang.reflect.Field;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

public class Main {

    public static void main(String[] args) throws Exception {
        if (args.length < 2) {
            System.err.println("Usage: Main <script-path> <output-path>");
            System.exit(2);
        }
        final String scriptPath = args[0];
        final String outputPath = args[1];

        HeadlessApplicationConfiguration cfg = new HeadlessApplicationConfiguration();
        cfg.updatesPerSecond = 0;

        HeadlessApplication app =
                new HeadlessApplication(new SimulationListener(scriptPath, outputPath), cfg);

        // Gdx.app.exit() is asynchronous: it posts a runnable that flips
        // `running` and lets the HeadlessApplication main loop fall out,
        // after which it invokes pause()+dispose() on the listener. To
        // guarantee the output file is flushed before the JVM exits, we
        // join() the main loop thread (dispose() writes the file).
        try {
            Field f = HeadlessApplication.class.getDeclaredField("mainLoopThread");
            f.setAccessible(true);
            Thread t = (Thread) f.get(app);
            if (t != null) {
                t.join();
            }
        } catch (NoSuchFieldException nsfe) {
            // Field name may differ across versions; fall back to a timed wait.
            long deadline = System.currentTimeMillis() + 60_000L;
            while (System.currentTimeMillis() < deadline) {
                try {
                    Thread.sleep(50);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    break;
                }
                if (!app.getApplicationListener().getClass()
                        .getDeclaredFields().toString().isEmpty()) {
                    // can't tell, just sleep until deadline
                }
                if (!((SimulationListener) app.getApplicationListener()).outputWritten()) {
                    continue;
                }
                break;
            }
        } catch (Throwable t) {
            // ignore - we'll System.exit(0) below regardless.
        }

        System.exit(0);
    }

    // ---------- Listener ----------

    public static class SimulationListener extends ApplicationAdapter {
        private final String scriptPath;
        private final String outputPath;

        private float dt = -1f;
        private int ticks = -1;
        private final LinkedHashMap<String, Actor> actors = new LinkedHashMap<>();
        private int ticksRemaining;
        private boolean initialized = false;
        private volatile boolean wroteOutput = false;

        public SimulationListener(String scriptPath, String outputPath) {
            this.scriptPath = scriptPath;
            this.outputPath = outputPath;
        }

        public boolean outputWritten() {
            return wroteOutput;
        }

        @Override
        public void create() {
            FileHandle fh = Gdx.files.absolute(scriptPath);
            if (!fh.exists()) {
                throw new RuntimeException("Script file not found: " + scriptPath);
            }
            String text = fh.readString("UTF-8");
            String[] lines = text.split("\r?\n", -1);

            boolean sawActorDirective = false;

            for (int i = 0; i < lines.length; i++) {
                String line = lines[i] == null ? "" : lines[i].trim();
                if (line.isEmpty() || line.startsWith("#")) {
                    continue;
                }
                String[] toks = line.split("[ \\t]+");
                String head = toks[0].toLowerCase(Locale.ROOT);
                switch (head) {
                    case "dt": {
                        if (dt > 0f) throw new RuntimeException("duplicate dt");
                        if (sawActorDirective) {
                            throw new RuntimeException("dt must appear before actor/moveby directives");
                        }
                        if (toks.length < 2) throw new RuntimeException("dt requires a value");
                        dt = Float.parseFloat(toks[1]);
                        if (!(dt > 0f) || Float.isNaN(dt) || Float.isInfinite(dt)) {
                            throw new RuntimeException("dt must be > 0");
                        }
                        break;
                    }
                    case "ticks": {
                        if (ticks >= 0) throw new RuntimeException("duplicate ticks");
                        if (sawActorDirective) {
                            throw new RuntimeException("ticks must appear before actor/moveby directives");
                        }
                        if (toks.length < 2) throw new RuntimeException("ticks requires a value");
                        ticks = Integer.parseInt(toks[1]);
                        if (ticks < 0) throw new RuntimeException("ticks must be >= 0");
                        break;
                    }
                    case "actor": {
                        if (dt < 0f) throw new RuntimeException("dt directive must precede actor");
                        if (ticks < 0) throw new RuntimeException("ticks directive must precede actor");
                        if (toks.length < 4) throw new RuntimeException("actor requires id x y");
                        String id = toks[1];
                        if (!id.matches("[A-Za-z0-9_]+")) {
                            throw new RuntimeException("invalid actor id: " + id);
                        }
                        if (actors.containsKey(id)) {
                            throw new RuntimeException("duplicate actor id: " + id);
                        }
                        float x = Float.parseFloat(toks[2]);
                        float y = Float.parseFloat(toks[3]);
                        Actor a = new Actor();
                        a.setPosition(x, y);
                        actors.put(id, a);
                        sawActorDirective = true;
                        break;
                    }
                    case "moveby": {
                        if (dt < 0f) throw new RuntimeException("dt directive must precede moveby");
                        if (ticks < 0) throw new RuntimeException("ticks directive must precede moveby");
                        if (toks.length < 5) throw new RuntimeException("moveby requires id dx dy duration");
                        String id = toks[1];
                        Actor target = actors.get(id);
                        if (target == null) {
                            throw new RuntimeException("moveby targets unknown actor: " + id);
                        }
                        if (target.getActions().size > 0) {
                            throw new RuntimeException("multiple moveby for actor: " + id);
                        }
                        float dx = Float.parseFloat(toks[2]);
                        float dy = Float.parseFloat(toks[3]);
                        float duration = Float.parseFloat(toks[4]);
                        if (!(duration >= 0f) || Float.isNaN(duration) || Float.isInfinite(duration)) {
                            throw new RuntimeException("duration must be >= 0");
                        }
                        MoveByAction action = new MoveByAction();
                        action.setAmount(dx, dy);
                        action.setDuration(duration);
                        target.addAction(action);
                        sawActorDirective = true;
                        break;
                    }
                    default:
                        throw new RuntimeException(
                                "Unknown directive: " + toks[0] + " (line " + (i + 1) + ")");
                }
            }

            if (dt <= 0f) throw new RuntimeException("missing dt directive");
            if (ticks < 0) throw new RuntimeException("missing ticks directive");

            this.ticksRemaining = ticks;
            this.initialized = true;
        }

        @Override
        public void render() {
            if (!initialized) return;
            if (ticksRemaining <= 0) {
                // We've already completed our budget. Make sure the main loop
                // exits; the listener's dispose() will write the output.
                Gdx.app.exit();
                return;
            }
            for (Actor a : actors.values()) {
                a.act(dt);
            }
            ticksRemaining--;
            if (ticksRemaining <= 0) {
                Gdx.app.exit();
            }
        }

        @Override
        public void dispose() {
            // Write the output file from dispose() so it is guaranteed to run
            // before the JVM exits.
            try (BufferedWriter bw = new BufferedWriter(
                    new PrintWriter(new FileWriter(outputPath, false)))) {
                for (Map.Entry<String, Actor> e : actors.entrySet()) {
                    Actor a = e.getValue();
                    float x = a.getX();
                    float y = a.getY();
                    String line = e.getKey() + "=" + String.format(Locale.ROOT, "%.6f,%.6f", x, y);
                    bw.write(line);
                    bw.write("\n");
                }
                bw.flush();
            } catch (IOException ex) {
                throw new RuntimeException("failed to write output", ex);
            }
            wroteOutput = true;
        }
    }
}
