/**
 * Queries callable from the client (and server) of the Wasp app.
 * Each named export corresponds to a `query` declaration in `main.wasp`.
 */

/**
 * getPosts: returns every post in the database. Each element has the
 * keys `id` (number) and `title` (string), plus a few more for
 * convenience (createdAt, authorUsername).
 */
export const getPosts = async (_args, context) => {
  if (!context.entities || !context.entities.Post) {
    throw new Error("Post entity is not available on the query context.");
  }
  const posts = await context.entities.Post.findMany({
    orderBy: { id: "asc" },
    include: {
      author: {
        select: { username: true },
      },
    },
  });
  return posts.map((p) => ({
    id: p.id,
    title: p.title,
    createdAt: p.createdAt,
    authorUsername: p.author ? p.author.username : null,
  }));
};

/**
 * getCommentTree: given a post, returns the post's top-level comments
 * (those with no parent), with each node containing the keys:
 *   { id, content, authorUsername, parentId, children }
 * where `children` is an array of the same shape, recursively nested
 * to any depth. Sibling nodes are ordered by ascending `id` at every
 * level.
 */
export const getCommentTree = async (args, context) => {
  const postId = args && args.postId;
  if (postId === undefined || postId === null) {
    throw new Error("getCommentTree requires a postId argument.");
  }

  // Make sure the post exists (helps give a clear error if it doesn't).
  const post = await context.entities.Post.findUnique({
    where: { id: postId },
  });
  if (!post) {
    return [];
  }

  // Fetch every comment for the post in a single query, including the
  // author so we can produce `authorUsername`.
  const flatComments = await context.entities.Comment.findMany({
    where: { postId: postId },
    orderBy: { id: "asc" },
    include: {
      author: {
        select: { username: true },
      },
    },
  });

  // Index by id for O(n) tree assembly.
  const byId = new Map();
  for (const c of flatComments) {
    byId.set(c.id, {
      id: c.id,
      content: c.content,
      authorUsername: c.author ? c.author.username : null,
      parentId: c.parentId,
      children: [],
    });
  }

  // Assemble the tree, then collect the top-level nodes.
  const roots = [];
  for (const node of byId.values()) {
    if (node.parentId == null) {
      roots.push(node);
    } else {
      const parent = byId.get(node.parentId);
      if (parent) {
        parent.children.push(node);
      } else {
        // Orphaned comment (parent got deleted). Treat as a root so
        // it remains visible to the user.
        roots.push(node);
      }
    }
  }

  return roots;
};
