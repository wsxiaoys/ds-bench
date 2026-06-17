package com.sim;

import com.badlogic.gdx.Gdx;
import java.io.BufferedReader;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

public class Scenario {
    public int ticks = 0;
    public int gravityX = 0;
    public int gravityY = 0;
    public int floorY = 0;
    public final List<Spawn> spawns = new ArrayList<>();

    public static class Spawn {
        public int id;
        public int tick;
        public int x;
        public int y;
        public int vx;
        public int vy;
    }

    public static Scenario load(String path) throws IOException {
        Scenario scenario = new Scenario();
        BufferedReader reader = new BufferedReader(Gdx.files.absolute(path).reader("UTF-8"));
        String line;
        int spawnId = 0;
        while ((line = reader.readLine()) != null) {
            line = line.trim();
            if (line.isEmpty() || line.startsWith("#")) {
                continue;
            }
            String[] parts = line.split("\\s+");
            if (parts.length == 0) continue;
            String directive = parts[0];
            if (directive.equals("TICKS")) {
                scenario.ticks = Integer.parseInt(parts[1]);
            } else if (directive.equals("GRAVITY")) {
                scenario.gravityX = Integer.parseInt(parts[1]);
                scenario.gravityY = Integer.parseInt(parts[2]);
            } else if (directive.equals("FLOOR")) {
                scenario.floorY = Integer.parseInt(parts[1]);
            } else if (directive.equals("SPAWN")) {
                Spawn spawn = new Spawn();
                spawn.id = spawnId++;
                spawn.tick = Integer.parseInt(parts[1]);
                spawn.x = Integer.parseInt(parts[2]);
                spawn.y = Integer.parseInt(parts[3]);
                spawn.vx = Integer.parseInt(parts[4]);
                spawn.vy = Integer.parseInt(parts[5]);
                scenario.spawns.add(spawn);
            }
        }
        reader.close();
        return scenario;
    }
}
