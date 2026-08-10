package com.scenebaker;

/**
 * Abstract base class for all scene-graph nodes.
 */
public abstract class Node {
    /** class tag / discriminator, e.g. "group", "sprite", "light", "trigger" */
    public String type;

    public String name;

    /** Only meaningful during deserialization/pruning; not part of output. */
    public boolean enabled = true;

    public float lx = 0f;
    public float ly = 0f;
    public float ls = 1f;

    /** Assigned during the id-assignment pass. */
    public int id;

    /** Computed during the transform pass. */
    public float absX;
    public float absY;
    public float absScale;

    public abstract String kindTag();
}
