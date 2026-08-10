package com.badlogic.gdx.utils;

public class EventHeap extends BinaryHeap<EventHeap.Event> {
    private Event[] myNodes;

    public EventHeap() {
        super(16, false);
        myNodes = new Event[16];
    }

    public static class Event extends BinaryHeap.Node {
        public final int time;
        public final int typePriority; // DEPART = 0, START_SERVICE = 1, ARRIVE = 2
        public final int sequence;
        public final String jobId;
        public final int serverIndex; // -1 if not applicable
        public final String typeName; // "ARRIVE", "START_SERVICE", "DEPART"

        public Event(int time, int typePriority, int sequence, String jobId, int serverIndex, String typeName) {
            super(0);
            this.time = time;
            this.typePriority = typePriority;
            this.sequence = sequence;
            this.jobId = jobId;
            this.serverIndex = serverIndex;
            this.typeName = typeName;
        }
    }

    public static int compare(Event a, Event b) {
        if (a.time != b.time) {
            return Integer.compare(a.time, b.time);
        }
        if (a.typePriority != b.typePriority) {
            return Integer.compare(a.typePriority, b.typePriority);
        }
        return Integer.compare(a.sequence, b.sequence);
    }

    @Override
    public Event add(Event node) {
        if (size == myNodes.length) {
            Event[] newNodes = new Event[size * 2];
            System.arraycopy(myNodes, 0, newNodes, 0, size);
            myNodes = newNodes;
        }
        node.index = size;
        myNodes[size] = node;
        size++;
        up(size - 1);
        return node;
    }

    @Override
    public Event add(Event node, float value) {
        node.value = value;
        return add(node);
    }

    private void up(int index) {
        Event node = myNodes[index];
        while (index > 0) {
            int parentIndex = (index - 1) >> 1;
            Event parent = myNodes[parentIndex];
            if (compare(node, parent) < 0) {
                myNodes[index] = parent;
                parent.index = index;
                index = parentIndex;
            } else {
                break;
            }
        }
        myNodes[index] = node;
        node.index = index;
    }

    private void down(int index) {
        Event node = myNodes[index];
        while (true) {
            int leftIndex = (index << 1) + 1;
            if (leftIndex >= size) break;
            int rightIndex = leftIndex + 1;
            
            int smallestIndex = leftIndex;
            Event smallestNode = myNodes[leftIndex];
            
            if (rightIndex < size) {
                Event rightNode = myNodes[rightIndex];
                if (compare(rightNode, smallestNode) < 0) {
                    smallestIndex = rightIndex;
                    smallestNode = rightNode;
                }
            }
            
            if (compare(smallestNode, node) < 0) {
                myNodes[index] = smallestNode;
                smallestNode.index = index;
                index = smallestIndex;
            } else {
                break;
            }
        }
        myNodes[index] = node;
        node.index = index;
    }

    @Override
    public Event peek() {
        if (size == 0) throw new IllegalStateException("The heap is empty.");
        return myNodes[0];
    }

    @Override
    public Event pop() {
        Event result = myNodes[0];
        size--;
        if (size > 0) {
            Event lastNode = myNodes[size];
            myNodes[size] = null;
            myNodes[0] = lastNode;
            lastNode.index = 0;
            down(0);
        } else {
            myNodes[0] = null;
        }
        return result;
    }

    @Override
    public Event remove(Event node) {
        int index = node.index;
        size--;
        if (size > 0) {
            Event lastNode = myNodes[size];
            myNodes[size] = null;
            myNodes[index] = lastNode;
            lastNode.index = index;
            if (compare(lastNode, node) < 0) {
                up(index);
            } else {
                down(index);
            }
        } else {
            myNodes[0] = null;
        }
        return node;
    }

    @Override
    public void setValue(Event node, float value) {
        node.value = value;
        // In case we ever change values, but we don't need it.
    }

    @Override
    public void clear() {
        for (int i = 0; i < size; i++) {
            myNodes[i] = null;
        }
        size = 0;
    }

    @Override
    public boolean notEmpty() {
        return size > 0;
    }

    @Override
    public boolean isEmpty() {
        return size == 0;
    }
}
