/**
 * Returns every post.
 * Each element includes `id` (number) and `title` (string).
 */
export const getPosts = async (_args, context) => {
  const posts = await context.entities.Post.findMany({
    orderBy: { id: 'asc' },
    select: {
      id: true,
      title: true,
    },
  });
  return posts;
};

/**
 * Returns the comments for a given post as a nested tree.
 *
 * Each node has exactly these keys:
 *   id (number), content (string), authorUsername (string),
 *   parentId (number | null), children (array of nodes)
 *
 * Sibling nodes are ordered by ascending `id` at every level.
 */
export const getCommentTree = async (args, context) => {
  const { postId } = args;

  // Fetch every comment for this post (at every depth) together with its
  // author, ordered by ascending id so we can build the tree deterministically.
  const comments = await context.entities.Comment.findMany({
    where: { postId },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      content: true,
      parentId: true,
      author: {
        select: { username: true },
      },
    },
  });

  // Build a flat map of every node keyed by id.
  const nodesById = new Map();
  for (const c of comments) {
    nodesById.set(c.id, {
      id: c.id,
      content: c.content,
      authorUsername: c.author.username,
      parentId: c.parentId,
      children: [],
    });
  }

  // Assemble the tree: attach each node to its parent's `children`, or collect
  // it as a top-level node when it has no parent.
  const topLevel = [];
  for (const c of comments) {
    const node = nodesById.get(c.id);
    if (c.parentId === null) {
      topLevel.push(node);
    } else {
      const parent = nodesById.get(c.parentId);
      if (parent) {
        parent.children.push(node);
      } else {
        // Orphan (shouldn't happen with cascade delete) — treat as top-level.
        topLevel.push(node);
      }
    }
  }

  // Because we iterated comments in ascending-id order, both `topLevel` and
  // every `children` array are already sorted by ascending id.
  return topLevel;
};