package com.scenebaker;

import com.badlogic.gdx.utils.Array;

public class GroupNode extends Node {
    public Array<Node> children = new Array<>();

    @Override
    public String kindTag() {
        return "group";
    }
}
