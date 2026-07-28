package com.badlogic.gdx.utils;

public class BinaryHeap<T extends BinaryHeap.Node> {
    public int size;
    private Node[] nodes;
    private final boolean isMaxHeap;

    public BinaryHeap() {
        this(16, false);
    }

    public BinaryHeap(int capacity, boolean isMaxHeap) {
        this.isMaxHeap = isMaxHeap;
        this.nodes = new Node[capacity];
    }

    public T add(T node) {
        // Dummy
        return node;
    }

    public T add(T node, float value) {
        node.value = value;
        return add(node);
    }

    public T peek() {
        return (T) nodes[0];
    }

    public T pop() {
        return (T) nodes[0];
    }

    public void clear() {
        size = 0;
    }

    public boolean isEmpty() {
        return size == 0;
    }

    public boolean notEmpty() {
        return size > 0;
    }

    public void setValue(T node, float value) {
        node.value = value;
    }

    public T remove(T node) {
        return node;
    }

    public static class Node {
        public float value;
        public int index;

        public Node(float value) {
            this.value = value;
        }

        public float getValue() {
            return value;
        }
    }
}
