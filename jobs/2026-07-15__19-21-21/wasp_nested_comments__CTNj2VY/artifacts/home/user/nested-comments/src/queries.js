import { HttpError } from "wasp/server";

// getPosts: returns every post.
export const getPosts = async (args, context) => {
  const posts = await context.entities.Post.findMany({
    orderBy: { id: "asc" },
  });
  return posts;
};

// getCommentTree: given a postId, returns that post's comments as a nested tree.
export const getCommentTree = async ({ postId }, context) => {
  if (postId === undefined || postId === null) {
    throw new HttpError(400, "postId is required");
  }

  const post = await context.entities.Post.findUnique({
    where: { id: postId },
  });
  if (!post) {
    throw new HttpError(404, "Post not found");
  }

  const comments = await context.entities.Comment.findMany({
    where: { postId },
    include: { author: true },
    orderBy: { id: "asc" },
  });

  const nodeById = new Map();
  for (const comment of comments) {
    nodeById.set(comment.id, {
      id: comment.id,
      content: comment.content,
      authorUsername: comment.author.username,
      parentId: comment.parentId,
      children: [],
    });
  }

  const topLevel = [];
  for (const comment of comments) {
    const node = nodeById.get(comment.id);
    if (comment.parentId === null || comment.parentId === undefined) {
      topLevel.push(node);
    } else {
      const parentNode = nodeById.get(comment.parentId);
      if (parentNode) {
        parentNode.children.push(node);
      } else {
        // Parent not part of this result set (shouldn't normally happen).
        topLevel.push(node);
      }
    }
  }

  const sortTree = (nodes) => {
    nodes.sort((a, b) => a.id - b.id);
    for (const node of nodes) {
      sortTree(node.children);
    }
  };
  sortTree(topLevel);

  return topLevel;
};
