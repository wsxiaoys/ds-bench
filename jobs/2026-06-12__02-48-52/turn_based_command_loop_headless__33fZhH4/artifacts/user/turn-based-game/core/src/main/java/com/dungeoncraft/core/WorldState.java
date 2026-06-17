package com.dungeoncraft.core;

import java.util.ArrayList;
import java.util.List;

/**
 * Immutable-field container for all mutable game state.
 * <p>
 * Coordinates use the lower-left origin: x grows east, y grows north.
 */
public final class WorldState {

    // ── map dimensions ────────────────────────────────────────────────────────
    public final int width;
    public final int height;

    // ── player ───────────────────────────────────────────────────────────────
    /** Player x position (east). */
    public int playerX;
    /** Player y position (north). */
    public int playerY;

    // ── items still on the map ────────────────────────────────────────────────
    /**
     * Items remaining on the floor, in the order they were defined in the map
     * file.  Entries are removed on PICK.
     */
    public final List<Item> floorItems;

    // ── player inventory ──────────────────────────────────────────────────────
    /** Items the player has picked up, in pickup order. */
    public final List<String> inventory;

    // ─────────────────────────────────────────────────────────────────────────
    public WorldState(int width, int height, int startX, int startY,
                      List<Item> floorItems) {
        this.width      = width;
        this.height     = height;
        this.playerX    = startX;
        this.playerY    = startY;
        this.floorItems = new ArrayList<>(floorItems);
        this.inventory  = new ArrayList<>();
    }

    // ── command execution ─────────────────────────────────────────────────────

    /** Move north (+y).  Rejected silently when out-of-bounds. */
    public void moveNorth() { if (playerY + 1 < height) playerY++; }

    /** Move south (-y).  Rejected silently when out-of-bounds. */
    public void moveSouth() { if (playerY - 1 >= 0) playerY--; }

    /** Move east (+x).  Rejected silently when out-of-bounds. */
    public void moveEast()  { if (playerX + 1 < width)  playerX++; }

    /** Move west (-x).  Rejected silently when out-of-bounds. */
    public void moveWest()  { if (playerX - 1 >= 0) playerX--; }

    /**
     * Pick up the earliest-defined item at the current cell.
     * No-op if no item is present.
     */
    public void pick() {
        for (int i = 0; i < floorItems.size(); i++) {
            Item item = floorItems.get(i);
            if (item.x == playerX && item.y == playerY) {
                floorItems.remove(i);
                inventory.add(item.name);
                return;
            }
        }
        // no item here — no-op
    }

    /** Render inventory as comma-separated names (empty string when empty). */
    public String inventoryString() {
        return String.join(",", inventory);
    }

    // ── inner class ───────────────────────────────────────────────────────────

    /** Represents one pickable item on the map floor. */
    public static final class Item {
        public final int    x;
        public final int    y;
        public final String name;

        public Item(int x, int y, String name) {
            this.x    = x;
            this.y    = y;
            this.name = name;
        }
    }
}
