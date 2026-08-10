package com.scenebaker;

public class LightNode extends Node {
    public String color;
    public float intensity;

    @Override
    public String kindTag() {
        return "light";
    }
}
