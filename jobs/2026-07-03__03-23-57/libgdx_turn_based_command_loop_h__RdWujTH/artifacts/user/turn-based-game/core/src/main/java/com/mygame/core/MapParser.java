package com.mygame.core;

import com.badlogic.gdx.files.FileHandle;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

public class MapParser {
    public static GameMap parse(FileHandle fileHandle) throws IOException {
        List<String> tokens = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(fileHandle.read(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty() || line.startsWith("#")) {
                    continue;
                }
                String[] parts = line.split("\\s+");
                for (String part : parts) {
                    if (!part.isEmpty()) {
                        tokens.add(part);
                    }
                }
            }
        }

        if (tokens.size() < 5) {
            throw new IllegalArgumentException("Invalid map file: too few tokens");
        }

        int width = Integer.parseInt(tokens.get(0));
        int height = Integer.parseInt(tokens.get(1));
        int playerStartX = Integer.parseInt(tokens.get(2));
        int playerStartY = Integer.parseInt(tokens.get(3));
        int itemCount = Integer.parseInt(tokens.get(4));

        List<GameMap.Item> items = new ArrayList<>();
        int index = 5;
        for (int i = 0; i < itemCount; i++) {
            if (index + 2 >= tokens.size()) {
                throw new IllegalArgumentException("Invalid map file: missing item tokens at index " + index);
            }
            int x = Integer.parseInt(tokens.get(index++));
            int y = Integer.parseInt(tokens.get(index++));
            String name = tokens.get(index++);
            items.add(new GameMap.Item(x, y, name));
        }

        return new GameMap(width, height, playerStartX, playerStartY, items);
    }
}
