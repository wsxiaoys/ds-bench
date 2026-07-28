package com.scenebaker;

import com.badlogic.gdx.utils.IntArray;
import com.badlogic.gdx.utils.ObjectMap;

public class TriggerNode extends Node {
    public String event;
    public ObjectMap<String, String> params = new ObjectMap<>();
    public IntArray targets = new IntArray();

    @Override
    public String kindTag() {
        return "trigger";
    }
}
