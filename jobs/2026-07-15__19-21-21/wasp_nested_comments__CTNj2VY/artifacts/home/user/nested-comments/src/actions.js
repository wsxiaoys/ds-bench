import { HttpError } from "wasp/server";

// createComment: creates a comment on a post, authored by a user (looked up
// by username), optionally as a reply to an existing comment.
export const createComment = async (
  { postId, authorUsername, content, parentId },
  context
) => {
  if (postId === undefined || postId === null) {
    throw new HttpError(400, "postId is required");
  }
  if (!authorUsername) {
    throw new HttpError(400, "authorUsername is required");
  }
  if (!content) {
    throw new HttpError(400, "content is required");
  }

  const post = await context.entities.Post.findUnique({
    where: { id: postId },
  });
  if (!post) {
    throw new HttpError(404, "Post not found");
  }

  const author = await context.entities.User.findUnique({
    where: { username: authorUsername },
  });
  if (!author) {
    throw new HttpError(404, `User '${authorUsername}' not found`);
  }

  const resolvedParentId =
    parentId === undefined || parentId === null ? null : parentId;

  if (resolvedParentId !== null) {
    const parentComment = await context.entities.Comment.findUnique({
      where: { id: resolvedParentId },
    });
    if (!parentComment || parentComment.postId !== postId) {
      throw new HttpError(404, "Parent comment not found on this post");
    }
  }

  const comment = await context.entities.Comment.create({
    data: {
      content,
      post: { connect: { id: postId } },
      author: { connect: { id: author.id } },
      ...(resolvedParentId !== null
        ? { parent: { connect: { id: resolvedParentId } } }
        : {}),
    },
  });

  return comment;
};

// deleteComment: deletes a comment and all of its descendant replies (cascade).
export const deleteComment = async ({ commentId }, context) => {
  if (commentId === undefined || commentId === null) {
    throw new HttpError(400, "commentId is required");
  }

  const comment = await context.entities.Comment.findUnique({
    where: { id: commentId },
  });
  if (!comment) {
    throw new HttpError(404, "Comment not found");
  }

  // Collect the whole subtree (comment + all descendants) so we can delete
  // it explicitly, regardless of DB-level cascade behavior.
  const idsToDelete = [commentId];
  let frontier = [commentId];
  while (frontier.length > 0) {
    const children = await context.entities.Comment.findMany({
      where: { parentId: { in: frontier } },
      select: { id: true },
    });
    const childIds = children.map((c) => c.id);
    if (childIds.length === 0) break;
    idsToDelete.push(...childIds);
    frontier = childIds;
  }

  await context.entities.Comment.deleteMany({
    where: { id: { in: idsToDelete } },
  });

  return { deletedIds: idsToDelete };
};
