package com.example.turnbased.core;

/**
 * A single item defined in the map file at position (x, y). Order in the file
 * determines pickup priority when multiple items share a cell.
 */
public final class Item {
    public final int x;
    public final int y;
    public final String name;

    public Item(int x, int y, String name) {
        this.x = x;
        this.y = y;
        this.name = name;
    }
}