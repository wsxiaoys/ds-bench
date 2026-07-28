package com.pochi.astar;

import com.badlogic.gdx.utils.BinaryHeap;

/**
 * A single grid cell as tracked by the A* search frontier. This is the
 * required custom subclass of {@link com.badlogic.gdx.utils.BinaryHeap.Node}
 * used as the open-set entry for {@link AStarSearch}.
 */
final class CellNode extends BinaryHeap.Node {

    final int row;
    final int col;

    /** Best known cost from the search source to this cell (double precision). */
    double g = Double.POSITIVE_INFINITY;

    /** Whether this node has been finalized (popped and fully relaxed). */
    boolean closed = false;

    CellNode(int row, int col) {
        // The BinaryHeap.Node value (float) is only used to drive the heap's
        // internal ordering; authoritative cost bookkeeping is done with the
        // double-precision 'g' field above.
        super(0f);
        this.row = row;
        this.col = col;
    }
}
