package com.scenebaker;

import com.badlogic.gdx.utils.Array;

/**
 * Implements steps 2-4 of the transformation pipeline: pruning disabled subtrees,
 * assigning pre-order ids, and computing absolute transforms.
 */
public final class ScenePipeline {

    private ScenePipeline() {
    }

    /** Removes every disabled node together with its entire subtree, in place. */
    public static void prune(GroupNode group) {
        Array<Node> kept = new Array<>(group.children.size);
        for (Node child : group.children) {
            if (!child.enabled) continue;
            if (child instanceof GroupNode) {
                prune((GroupNode) child);
            }
            kept.add(child);
        }
        group.children = kept;
    }

    /** Assigns integer ids in pre-order (depth-first), root first, starting at 0. */
    public static void assignIds(Node root) {
        assignIds(root, new int[]{0});
    }

    private static void assignIds(Node node, int[] counter) {
        node.id = counter[0]++;
        if (node instanceof GroupNode) {
            for (Node child : ((GroupNode) node).children) {
                assignIds(child, counter);
            }
        }
    }

    /** Composes absolute transforms top-down. The root's parent frame is scale 1, x 0, y 0. */
    public static void computeTransforms(Node node, float parentAbsScale, float parentAbsX, float parentAbsY) {
        node.absScale = parentAbsScale * node.ls;
        node.absX = parentAbsX + parentAbsScale * node.lx;
        node.absY = parentAbsY + parentAbsScale * node.ly;
        if (node instanceof GroupNode) {
            for (Node child : ((GroupNode) node).children) {
                computeTransforms(child, node.absScale, node.absX, node.absY);
            }
        }
    }
}
