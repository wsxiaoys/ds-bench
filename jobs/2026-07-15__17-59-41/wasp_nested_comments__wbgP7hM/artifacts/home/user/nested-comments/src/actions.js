/**
 * Creates a comment on a post, authored by a user (looked up by username),
 * optionally as a reply to an existing comment.
 *
 * Args: { postId: number, authorUsername: string, content: string, parentId?: number | null }
 * Returns the created comment object (must include `id`).
 */
export const createComment = async (args, context) => {
  const { postId, authorUsername, content, parentId } = args;

  // Look up the author by username.
  const author = await context.entities.User.findUnique({
    where: { username: authorUsername },
  });
  if (!author) {
    throw new Error(`User with username "${authorUsername}" not found`);
  }

  // Verify the post exists.
  const post = await context.entities.Post.findUnique({
    where: { id: postId },
  });
  if (!post) {
    throw new Error(`Post with id ${postId} not found`);
  }

  // If a parentId is provided, verify the parent comment exists and belongs
  // to the same post (keeps the tree consistent).
  if (parentId != null) {
    const parent = await context.entities.Comment.findUnique({
      where: { id: parentId },
    });
    if (!parent) {
      throw new Error(`Parent comment with id ${parentId} not found`);
    }
  }

  const comment = await context.entities.Comment.create({
    data: {
      content,
      postId,
      authorId: author.id,
      parentId: parentId ?? null,
    },
  });

  return comment;
};

/**
 * Deletes a comment AND all of its descendant replies (cascade).
 *
 * Args: { commentId: number }
 *
 * We explicitly collect every descendant via BFS and delete them all in one
 * batch so no orphaned replies remain, regardless of database-level cascade
 * support.
 */
export const deleteComment = async (args, context) => {
  const { commentId } = args;

  // Collect the target comment and all of its descendants recursively.
  const toDelete = new Set([commentId]);
  let frontier = [commentId];

  while (frontier.length > 0) {
    const children = await context.entities.Comment.findMany({
      where: { parentId: { in: frontier } },
      select: { id: true },
    });

    const newIds = children
      .map((c) => c.id)
      .filter((id) => !toDelete.has(id));

    newIds.forEach((id) => toDelete.add(id));
    frontier = newIds;
  }

  // Delete the entire subtree (the comment itself plus all descendants).
  await context.entities.Comment.deleteMany({
    where: { id: { in: [...toDelete] } },
  });
};