package com.example.turnbased.core;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.Collections;
import java.util.List;

/**
 * In-memory world model. Holds map dimensions, the player's current position,
 * the set of items remaining on the floor (in map definition order) and the
 * player's inventory (in pickup order).
 */
public final class World {
    public final int width;
    public final int height;
    public int playerX;
    public int playerY;

    private final List<Item> items;
    private final List<String> inventory;

    public World(int width, int height, int playerX, int playerY, List<Item> items) {
        if (width < 0 || height < 0) {
            throw new IllegalArgumentException("Map dimensions must be non-negative");
        }
        this.width = width;
        this.height = height;
        this.playerX = playerX;
        this.playerY = playerY;
        this.items = new ArrayList<>(items);
        this.inventory = new ArrayList<>();
    }

    public List<String> getInventory() {
        return Collections.unmodifiableList(inventory);
    }

    /**
     * Attempts to move the player by (dx, dy). Returns true if the move was
     * applied, false if it would have left the map (in which case the player
     * stays put).
     */
    public boolean tryMove(int dx, int dy) {
        int nx = playerX + dx;
        int ny = playerY + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
            return false;
        }
        playerX = nx;
        playerY = ny;
        return true;
    }

    /**
     * Picks up exactly one item located at the player's current cell. When
     * several items share the cell, the one defined earliest in the map file
     * wins. Returns the picked item's name, or null when nothing was picked.
     */
    public String tryPick() {
        Iterator<Item> it = items.iterator();
        while (it.hasNext()) {
            Item candidate = it.next();
            if (candidate.x == playerX && candidate.y == playerY) {
                it.remove();
                inventory.add(candidate.name);
                return candidate.name;
            }
        }
        return null;
    }
}