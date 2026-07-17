/**
 * Actions callable from the client (and server) of the Wasp app.
 * Each named export corresponds to an `action` declaration in `main.wasp`.
 */

/**
 * createComment: creates a comment on a post, authored by the user
 * with the given `authorUsername`. If `parentId` is provided (and not
 * null), the new comment is a reply to that existing comment;
 * otherwise it is a top-level comment on the post.
 *
 * Returns the created comment object, including its `id`.
 */
export const createComment = async (args, context) => {
  const { postId, authorUsername, content, parentId } = args || {};

  if (postId === undefined || postId === null) {
    throw new Error("createComment requires a `postId`.");
  }
  if (!authorUsername || typeof authorUsername !== "string") {
    throw new Error("createComment requires an `authorUsername` string.");
  }
  if (!content || typeof content !== "string") {
    throw new Error("createComment requires a `content` string.");
  }

  // Verify the post exists.
  const post = await context.entities.Post.findUnique({
    where: { id: postId },
  });
  if (!post) {
    throw new Error(`Post with id ${postId} not found.`);
  }

  // Look up the author by username.
  const author = await context.entities.User.findUnique({
    where: { username: authorUsername },
  });
  if (!author) {
    throw new Error(`User with username '${authorUsername}' not found.`);
  }

  // If a parentId was supplied, verify the parent comment exists and
  // belongs to the same post.
  let resolvedParentId = null;
  if (parentId !== undefined && parentId !== null) {
    const parent = await context.entities.Comment.findUnique({
      where: { id: parentId },
    });
    if (!parent) {
      throw new Error(`Parent comment with id ${parentId} not found.`);
    }
    if (parent.postId !== postId) {
      throw new Error(
        `Parent comment ${parentId} does not belong to post ${postId}.`
      );
    }
    resolvedParentId = parent.id;
  }

  const created = await context.entities.Comment.create({
    data: {
      content,
      postId: postId,
      authorId: author.id,
      parentId: resolvedParentId,
    },
    include: {
      author: {
        select: { username: true },
      },
    },
  });

  return {
    id: created.id,
    content: created.content,
    postId: created.postId,
    authorId: created.authorId,
    authorUsername: created.author ? created.author.username : null,
    parentId: created.parentId,
    createdAt: created.createdAt,
  };
};

/**
 * deleteComment: deletes a comment AND all of its descendant replies
 * (the entire subtree beneath it). We rely on Prisma's
 * `onDelete: Cascade` on the Comment self-relation, so deleting the
 * root of the subtree cascades to every descendant.
 */
export const deleteComment = async (args, context) => {
  const { commentId } = args || {};
  if (commentId === undefined || commentId === null) {
    throw new Error("deleteComment requires a `commentId`.");
  }

  const existing = await context.entities.Comment.findUnique({
    where: { id: commentId },
  });
  if (!existing) {
    // Idempotent: deleting a non-existent comment is a no-op.
    return { ok: true, deletedCount: 0 };
  }

  // Collect the entire subtree (the comment itself plus all
  // descendants) so we can report a count and so the cascade is
  // observable even if the cascade is disabled.
  const subtreeIds = await collectSubtreeIds(context.entities.Comment, commentId);

  await context.entities.Comment.delete({
    where: { id: commentId },
  });

  return { ok: true, deletedCount: subtreeIds.length };
};

/**
 * Returns the ids of the comment subtree rooted at `rootId`,
 * including `rootId` itself. Performs a BFS using Prisma queries.
 */
async function collectSubtreeIds(commentDelegate, rootId) {
  const ids = [];
  const queue = [rootId];
  while (queue.length > 0) {
    const current = queue.shift();
    ids.push(current);
    const children = await commentDelegate.findMany({
      where: { parentId: current },
      select: { id: true },
    });
    for (const child of children) {
      queue.push(child.id);
    }
  }
  return ids;
}
