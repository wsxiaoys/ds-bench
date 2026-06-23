package com.mygame.core;

public class Item {
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
