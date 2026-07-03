package com.mygame.core;

import java.util.ArrayList;
import java.util.List;

public class GameMap {
    public final int width;
    public final int height;
    public final int playerStartX;
    public final int playerStartY;
    public final List<Item> items;

    public GameMap(int width, int height, int playerStartX, int playerStartY, List<Item> items) {
        this.width = width;
        this.height = height;
        this.playerStartX = playerStartX;
        this.playerStartY = playerStartY;
        this.items = items;
    }

    public static class Item {
        public final int x;
        public final int y;
        public final String name;
        public boolean pickedUp = false;

        public Item(int x, int y, String name) {
            this.x = x;
            this.y = y;
            this.name = name;
        }
    }
}
