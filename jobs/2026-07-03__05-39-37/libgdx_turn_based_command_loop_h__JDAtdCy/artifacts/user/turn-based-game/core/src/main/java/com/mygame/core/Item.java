package com.mygame.core;

/**
 * A simple world item. Items are kept in definition order so that, when several
 * items occupy the same cell, the one defined earliest in the map file is the
 * first to be picked up.
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