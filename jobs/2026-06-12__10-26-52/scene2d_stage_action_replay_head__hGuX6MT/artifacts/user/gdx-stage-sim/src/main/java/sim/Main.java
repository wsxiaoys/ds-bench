package sim;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;
import com.badlogic.gdx.scenes.scene2d.Actor;
import com.badlogic.gdx.scenes.scene2d.actions.Actions;
import com.badlogic.gdx.scenes.scene2d.actions.MoveByAction;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.CountDownLatch;

public class Main {
    public static void main(String[] args) {
        if (args.length < 2) {
            System.err.println("Usage: Main <script-path> <output-path>");
            System.exit(1);
        }

        String scriptPath = args[0];
        String outputPath = args[1];

        CountDownLatch latch = new CountDownLatch(1);

        HeadlessApplicationConfiguration config = new HeadlessApplicationConfiguration();
        config.updatesPerSecond = 0;

        new HeadlessApplication(new ApplicationAdapter() {
            private float dt = 0;
            private int ticks = 0;
            private int currentTick = 0;
            private Map<String, Actor> actors = new LinkedHashMap<>();
            private List<String> actorOrder = new ArrayList<>();

            @Override
            public void create() {
                try (BufferedReader br = new BufferedReader(Gdx.files.absolute(scriptPath).reader("UTF-8"))) {
                    String line;
                    while ((line = br.readLine()) != null) {
                        line = line.trim();
                        if (line.isEmpty() || line.startsWith("#")) continue;

                        String[] tokens = line.split("\\s+");
                        String cmd = tokens[0].toLowerCase(Locale.ROOT);

                        switch (cmd) {
                            case "dt":
                                dt = Float.parseFloat(tokens[1]);
                                break;
                            case "ticks":
                                ticks = Integer.parseInt(tokens[1]);
                                break;
                            case "actor": {
                                String id = tokens[1];
                                float x = Float.parseFloat(tokens[2]);
                                float y = Float.parseFloat(tokens[3]);
                                Actor actor = new Actor();
                                actor.setPosition(x, y);
                                actors.put(id, actor);
                                actorOrder.add(id);
                                break;
                            }
                            case "moveby": {
                                String id = tokens[1];
                                float dx = Float.parseFloat(tokens[2]);
                                float dy = Float.parseFloat(tokens[3]);
                                float duration = Float.parseFloat(tokens[4]);
                                Actor actor = actors.get(id);
                                if (actor != null) {
                                    MoveByAction action = Actions.moveBy(dx, dy, duration);
                                    actor.addAction(action);
                                }
                                break;
                            }
                        }
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                    Gdx.app.exit();
                }

                if (ticks == 0) {
                    Gdx.app.exit();
                }
            }

            @Override
            public void render() {
                if (currentTick < ticks) {
                    for (String id : actorOrder) {
                        actors.get(id).act(dt);
                    }
                    currentTick++;
                    if (currentTick >= ticks) {
                        Gdx.app.exit();
                    }
                }
            }

            @Override
            public void dispose() {
                try (BufferedWriter bw = new BufferedWriter(Gdx.files.absolute(outputPath).writer(false, "UTF-8"))) {
                    for (String id : actorOrder) {
                        Actor actor = actors.get(id);
                        bw.write(String.format(Locale.ROOT, "%s=%.6f,%.6f\n", id, actor.getX(), actor.getY()));
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                }
                latch.countDown();
            }
        }, config);

        try {
            latch.await();
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
    }
}
