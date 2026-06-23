package com.example.gdxstagesim;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import com.badlogic.gdx.files.FileHandle;
import com.badlogic.gdx.scenes.scene2d.Actor;
import com.badlogic.gdx.scenes.scene2d.actions.Actions;
import com.badlogic.gdx.utils.GdxRuntimeException;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

public final class StageSimMain {
    private StageSimMain() {
    }

    public static void main(String[] args) throws InterruptedException {
        if (args.length != 2) {
            throw new IllegalArgumentException("Usage: <script-path> <output-path>");
        }

        HeadlessApplicationConfiguration configuration = new HeadlessApplicationConfiguration();
        configuration.updatesPerSecond = 0;

        JoiningHeadlessApplication application = new JoiningHeadlessApplication(
                new StageSimulation(args[0], args[1]),
                configuration
        );
        application.joinMainLoop();
    }

    private static final class JoiningHeadlessApplication extends HeadlessApplication {
        private JoiningHeadlessApplication(ApplicationAdapter listener, HeadlessApplicationConfiguration config) {
            super(listener, config);
        }

        private void joinMainLoop() throws InterruptedException {
            mainLoopThread.join();
        }
    }

    private static final class StageSimulation extends ApplicationAdapter {
        private static final String ID_PATTERN = "[A-Za-z0-9_]+";

        private final String scriptPath;
        private final String outputPath;
        private final List<ActorRecord> actors = new ArrayList<>();
        private final Map<String, ActorRecord> actorsById = new HashMap<>();
        private final Set<String> moveTargets = new HashSet<>();

        private float dt;
        private int ticks;
        private int completedTicks;
        private boolean outputWritten;

        private StageSimulation(String scriptPath, String outputPath) {
            this.scriptPath = scriptPath;
            this.outputPath = outputPath;
        }

        @Override
        public void create() {
            parseScript(Gdx.files.absolute(scriptPath));
            if (ticks == 0) {
                Gdx.app.exit();
            }
        }

        @Override
        public void render() {
            if (completedTicks >= ticks) {
                Gdx.app.exit();
                return;
            }

            for (ActorRecord actorRecord : actors) {
                actorRecord.actor.act(dt);
            }

            completedTicks++;
            if (completedTicks >= ticks) {
                Gdx.app.exit();
            }
        }

        @Override
        public void dispose() {
            if (outputWritten) {
                return;
            }

            StringBuilder output = new StringBuilder();
            for (ActorRecord actorRecord : actors) {
                Actor actor = actorRecord.actor;
                output.append(actorRecord.id)
                        .append('=')
                        .append(String.format(Locale.ROOT, "%.6f,%.6f", actor.getX(), actor.getY()))
                        .append('\n');
            }
            Gdx.files.absolute(outputPath).writeString(output.toString(), false, "UTF-8");
            outputWritten = true;
        }

        private void parseScript(FileHandle scriptFile) {
            boolean sawDt = false;
            boolean sawTicks = false;
            String script = scriptFile.readString("UTF-8");
            String[] lines = script.split("\\R", -1);

            for (int i = 0; i < lines.length; i++) {
                String line = lines[i].trim();
                if (line.isEmpty() || line.startsWith("#")) {
                    continue;
                }

                String[] tokens = line.split("[ \\t]+");
                String directive = tokens[0].toLowerCase(Locale.ROOT);
                int lineNumber = i + 1;

                switch (directive) {
                    case "dt":
                        requireTokenCount(tokens, 2, lineNumber);
                        if (sawDt) {
                            fail(lineNumber, "dt must appear exactly once");
                        }
                        ensureNoActorsDeclared(lineNumber);
                        dt = parseFloat(tokens[1], lineNumber, "dt");
                        if (!(dt > 0.0f)) {
                            fail(lineNumber, "dt must be > 0");
                        }
                        sawDt = true;
                        break;
                    case "ticks":
                        requireTokenCount(tokens, 2, lineNumber);
                        if (sawTicks) {
                            fail(lineNumber, "ticks must appear exactly once");
                        }
                        ensureNoActorsDeclared(lineNumber);
                        ticks = parseInt(tokens[1], lineNumber, "ticks");
                        if (ticks < 0) {
                            fail(lineNumber, "ticks must be >= 0");
                        }
                        sawTicks = true;
                        break;
                    case "actor":
                        requireHeaderDirectives(sawDt, sawTicks, lineNumber);
                        requireTokenCount(tokens, 4, lineNumber);
                        parseActor(tokens, lineNumber);
                        break;
                    case "moveby":
                        requireHeaderDirectives(sawDt, sawTicks, lineNumber);
                        requireTokenCount(tokens, 5, lineNumber);
                        parseMoveBy(tokens, lineNumber);
                        break;
                    default:
                        fail(lineNumber, "unknown directive: " + tokens[0]);
                }
            }

            if (!sawDt) {
                throw new GdxRuntimeException("Script is missing dt directive");
            }
            if (!sawTicks) {
                throw new GdxRuntimeException("Script is missing ticks directive");
            }
        }

        private void parseActor(String[] tokens, int lineNumber) {
            String id = tokens[1];
            if (!id.matches(ID_PATTERN)) {
                fail(lineNumber, "actor id must be alphanumeric/underscore: " + id);
            }
            if (actorsById.containsKey(id)) {
                fail(lineNumber, "duplicate actor id: " + id);
            }

            float x = parseFloat(tokens[2], lineNumber, "x");
            float y = parseFloat(tokens[3], lineNumber, "y");
            Actor actor = new Actor();
            actor.setPosition(x, y);

            ActorRecord actorRecord = new ActorRecord(id, actor);
            actors.add(actorRecord);
            actorsById.put(id, actorRecord);
        }

        private void parseMoveBy(String[] tokens, int lineNumber) {
            String id = tokens[1];
            ActorRecord actorRecord = actorsById.get(id);
            if (actorRecord == null) {
                fail(lineNumber, "moveby references unknown actor: " + id);
            }
            if (!moveTargets.add(id)) {
                fail(lineNumber, "actor already has a moveby action: " + id);
            }

            float dx = parseFloat(tokens[2], lineNumber, "dx");
            float dy = parseFloat(tokens[3], lineNumber, "dy");
            float duration = parseFloat(tokens[4], lineNumber, "duration");
            if (duration < 0.0f) {
                fail(lineNumber, "duration must be >= 0");
            }

            actorRecord.actor.addAction(Actions.moveBy(dx, dy, duration));
        }

        private void requireHeaderDirectives(boolean sawDt, boolean sawTicks, int lineNumber) {
            if (!sawDt || !sawTicks) {
                fail(lineNumber, "dt and ticks must appear before actor-related directives");
            }
        }

        private void ensureNoActorsDeclared(int lineNumber) {
            if (!actors.isEmpty()) {
                fail(lineNumber, "dt and ticks must appear before actor-related directives");
            }
        }

        private void requireTokenCount(String[] tokens, int expected, int lineNumber) {
            if (tokens.length != expected) {
                fail(lineNumber, "expected " + expected + " tokens but found " + tokens.length);
            }
        }

        private int parseInt(String token, int lineNumber, String name) {
            try {
                return Integer.parseInt(token);
            } catch (NumberFormatException e) {
                throw new GdxRuntimeException("Line " + lineNumber + ": invalid integer for " + name + ": " + token, e);
            }
        }

        private float parseFloat(String token, int lineNumber, String name) {
            try {
                return Float.parseFloat(token);
            } catch (NumberFormatException e) {
                throw new GdxRuntimeException("Line " + lineNumber + ": invalid float for " + name + ": " + token, e);
            }
        }

        private void fail(int lineNumber, String message) {
            throw new GdxRuntimeException("Line " + lineNumber + ": " + message);
        }
    }

    private static final class ActorRecord {
        private final String id;
        private final Actor actor;

        private ActorRecord(String id, Actor actor) {
            this.id = id;
            this.actor = actor;
        }
    }
}
