package com.scenebaker;

import com.badlogic.gdx.utils.IntArray;

public class SpriteNode extends Node {
    public String region;
    public int z;
    public IntArray frames = new IntArray();

    @Override
    public String kindTag() {
        return "sprite";
    }
}
