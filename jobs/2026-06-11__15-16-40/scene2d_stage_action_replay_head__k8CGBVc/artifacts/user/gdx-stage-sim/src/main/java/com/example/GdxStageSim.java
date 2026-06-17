package com.example;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import com.badlogic.gdx.files.FileHandle;
import com.badlogic.gdx.scenes.scene2d.Actor;
import com.badlogic.gdx.scenes.scene2d.actions.Actions;
import com.badlogic.gdx.scenes.scene2d.actions.MoveByAction;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.HashSet;
import java.util.Set;

public class GdxStageSim extends ApplicationAdapter {
    private final String scriptPath;
    private final String outputPath;

    private float dt = -1f;
    private int ticks = -1;
    private final List<Actor> actors = new ArrayList<>();
    private final Map<String, Actor> actorMap = new LinkedHashMap<>();
    private int currentTick = 0;

    private static volatile boolean finished = false;

    public GdxStageSim(String scriptPath, String outputPath) {
        this.scriptPath = scriptPath;
        this.outputPath = outputPath;
    }

    @Override
    public void create() {
        try {
            FileHandle handle = Gdx.files.absolute(scriptPath);
            if (!handle.exists()) {
                throw new IllegalArgumentException("Script file does not exist: " + scriptPath);
            }
            String content = handle.readString("UTF-8");
            String[] lines = content.split("\\r?\\n");

            boolean dtDeclared = false;
            boolean ticksDeclared = false;
            Set<String> movedActors = new HashSet<>();

            for (String line : lines) {
                line = line.trim();
                if (line.isEmpty() || line.startsWith("#")) {
                    continue;
                }
                String[] tokens = line.split("\\s+");
                if (tokens.length == 0) continue;

                String command = tokens[0].toLowerCase(Locale.ROOT);
                if ("dt".equals(command)) {
                    if (dtDeclared) {
                        throw new IllegalArgumentException("dt directive declared more than once.");
                    }
                    if (!actors.isEmpty() || !movedActors.isEmpty()) {
                        throw new IllegalArgumentException("dt directive must appear before any actor-related directive.");
                    }
                    if (tokens.length < 2) {
                        throw new IllegalArgumentException("dt directive missing value.");
                    }
                    dt = Float.parseFloat(tokens[1]);
                    if (dt <= 0) {
                        throw new IllegalArgumentException("dt must be greater than 0.");
                    }
                    dtDeclared = true;
                } else if ("ticks".equals(command)) {
                    if (ticksDeclared) {
                        throw new IllegalArgumentException("ticks directive declared more than once.");
                    }
                    if (!actors.isEmpty() || !movedActors.isEmpty()) {
                        throw new IllegalArgumentException("ticks directive must appear before any actor-related directive.");
                    }
                    if (tokens.length < 2) {
                        throw new IllegalArgumentException("ticks directive missing value.");
                    }
                    ticks = Integer.parseInt(tokens[1]);
                    if (ticks < 0) {
                        throw new IllegalArgumentException("ticks must be greater than or equal to 0.");
                    }
                    ticksDeclared = true;
                } else if ("actor".equals(command)) {
                    if (!dtDeclared || !ticksDeclared) {
                        throw new IllegalArgumentException("dt and ticks must be declared before any actor directive.");
                    }
                    if (tokens.length < 4) {
                        throw new IllegalArgumentException("actor directive requires id, x, and y.");
                    }
                    String id = tokens[1];
                    if (actorMap.containsKey(id)) {
                        throw new IllegalArgumentException("Duplicate actor ID: " + id);
                    }
                    float x = Float.parseFloat(tokens[2]);
                    float y = Float.parseFloat(tokens[3]);

                    Actor actor = new Actor();
                    actor.setName(id);
                    actor.setPosition(x, y);
                    actors.add(actor);
                    actorMap.put(id, actor);
                } else if ("moveby".equals(command)) {
                    if (!dtDeclared || !ticksDeclared) {
                        throw new IllegalArgumentException("dt and ticks must be declared before any moveby directive.");
                    }
                    if (tokens.length < 5) {
                        throw new IllegalArgumentException("moveby directive requires id, dx, dy, and duration.");
                    }
                    String id = tokens[1];
                    Actor actor = actorMap.get(id);
                    if (actor == null) {
                        throw new IllegalArgumentException("Unknown actor ID in moveby: " + id);
                    }
                    if (movedActors.contains(id)) {
                        throw new IllegalArgumentException("At most one moveby directive may target actor: " + id);
                    }
                    float dx = Float.parseFloat(tokens[2]);
                    float dy = Float.parseFloat(tokens[3]);
                    float duration = Float.parseFloat(tokens[4]);
                    if (duration < 0) {
                        throw new IllegalArgumentException("duration must be greater than or equal to 0.");
                    }

                    MoveByAction action = Actions.moveBy(dx, dy, duration);
                    actor.addAction(action);
                    movedActors.add(id);
                } else {
                    throw new IllegalArgumentException("Unknown directive: " + tokens[0]);
                }
            }

            if (!dtDeclared) {
                throw new IllegalArgumentException("dt directive is missing.");
            }
            if (!ticksDeclared) {
                throw new IllegalArgumentException("ticks directive is missing.");
            }

        } catch (Exception e) {
            e.printStackTrace();
            Gdx.app.exit();
        }
    }

    @Override
    public void render() {
        if (currentTick < ticks) {
            for (Actor actor : actors) {
                actor.act(dt);
            }
            currentTick++;
            if (currentTick >= ticks) {
                Gdx.app.exit();
            }
        } else {
            Gdx.app.exit();
        }
    }

    @Override
    public void dispose() {
        try {
            StringBuilder sb = new StringBuilder();
            for (Actor actor : actors) {
                sb.append(String.format(Locale.ROOT, "%s=%.6f,%.6f\n", actor.getName(), actor.getX(), actor.getY()));
            }
            Gdx.files.absolute(outputPath).writeString(sb.toString(), false, "UTF-8");
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            finished = true;
        }
    }

    public static void main(String[] args) {
        if (args.length < 2) {
            System.err.println("Usage: GdxStageSim <script-path> <output-path>");
            System.exit(1);
        }
        String scriptPath = args[0];
        String outputPath = args[1];

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 0;

        GdxStageSim listener = new GdxStageSim(scriptPath, outputPath);
        new HeadlessApplication(listener, config);

        // Find and join the HeadlessApplication thread
        Thread headlessThread = null;
        while (headlessThread == null && !finished) {
            Thread[] threads = new Thread[Thread.activeCount() * 2];
            int count = Thread.enumerate(threads);
            for (int i = 0; i < count; i++) {
                if (threads[i] != null && threads[i].getName().startsWith("HeadlessApplication")) {
                    headlessThread = threads[i];
                    break;
                }
            }
            if (headlessThread == null) {
                try {
                    Thread.sleep(10);
                } catch (InterruptedException e) {
                    break;
                }
            }
        }
        if (headlessThread != null) {
            try {
                headlessThread.join();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
    }
}
