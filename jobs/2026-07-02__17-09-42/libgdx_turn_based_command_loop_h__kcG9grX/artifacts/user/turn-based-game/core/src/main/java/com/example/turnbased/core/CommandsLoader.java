package com.example.turnbased.core;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.files.FileHandle;

import java.util.ArrayList;
import java.util.List;

/**
 * Reads a commands file. Each non-blank, non-comment line contributes exactly
 * one command token (the trimmed text of the line).
 */
public final class CommandsLoader {

    private CommandsLoader() {}

    public static List<String> load(String absolutePath) {
        FileHandle fh = Gdx.files.absolute(absolutePath);
        String content = fh.readString("UTF-8");
        return parse(content);
    }

    static List<String> parse(String content) {
        List<String> out = new ArrayList<>();
        for (String line : content.split("\\R")) {
            String trimmed = line.trim();
            if (trimmed.isEmpty() || trimmed.startsWith("#")) {
                continue;
            }
            out.add(trimmed);
        }
        return out;
    }
}