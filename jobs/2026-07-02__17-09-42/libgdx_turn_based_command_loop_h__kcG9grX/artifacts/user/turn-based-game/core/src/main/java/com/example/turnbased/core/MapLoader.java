package com.example.turnbased.core;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.files.FileHandle;

import java.util.ArrayList;
import java.util.List;

/**
 * Parses a map file in the format described by the task. Blank lines and
 * lines starting with '#' are ignored. All other tokens are whitespace
 * separated.
 */
public final class MapLoader {

    private MapLoader() {}

    public static World load(String absolutePath) {
        FileHandle fh = Gdx.files.absolute(absolutePath);
        String content = fh.readString("UTF-8");
        return parse(content);
    }

    static World parse(String content) {
        List<String> toks = tokenize(content);
        if (toks.size() < 5) {
            throw new IllegalArgumentException("Map file is missing header tokens");
        }

        int idx = 0;
        int width = parseInt(toks.get(idx++), "width");
        int height = parseInt(toks.get(idx++), "height");
        int px = parseInt(toks.get(idx++), "player x");
        int py = parseInt(toks.get(idx++), "player y");
        int itemCount = parseInt(toks.get(idx++), "item count");

        if (toks.size() < idx + itemCount * 3) {
            throw new IllegalArgumentException(
                "Map file declares " + itemCount + " items but does not list them");
        }

        List<Item> items = new ArrayList<>(itemCount);
        for (int i = 0; i < itemCount; i++) {
            int x = parseInt(toks.get(idx++), "item[" + i + "] x");
            int y = parseInt(toks.get(idx++), "item[" + i + "] y");
            String name = toks.get(idx++);
            if (name.isEmpty()) {
                throw new IllegalArgumentException("Item name must not be empty");
            }
            items.add(new Item(x, y, name));
        }
        return new World(width, height, px, py, items);
    }

    private static List<String> tokenize(String content) {
        List<String> out = new ArrayList<>();
        for (String line : content.split("\\R")) {
            String trimmed = line.trim();
            if (trimmed.isEmpty() || trimmed.startsWith("#")) {
                continue;
            }
            for (String t : trimmed.split("\\s+")) {
                out.add(t);
            }
        }
        return out;
    }

    private static int parseInt(String token, String field) {
        try {
            return Integer.parseInt(token);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(
                "Expected integer for " + field + " but got '" + token + "'", e);
        }
    }
}