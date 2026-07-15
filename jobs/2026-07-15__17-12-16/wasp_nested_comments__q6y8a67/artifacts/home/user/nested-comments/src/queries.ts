interface GetCommentTreeArgs {
  postId: number;
}

interface CommentNode {
  id: number;
  content: string;
  authorUsername: string;
  parentId: number | null;
  children: CommentNode[];
  [key: string]: any;
}

export const getPosts = async (args: void, context: { entities: { Post: any } }) => {
  return context.entities.Post.findMany({
    select: {
      id: true,
      title: true
    }
  });
};

export const getCommentTree = async (
  args: GetCommentTreeArgs,
  context: { entities: { Comment: any } }
): Promise<CommentNode[]> => {
  const { postId } = args;
  
  const comments = await context.entities.Comment.findMany({
    where: { postId },
    include: {
      author: true
    },
    orderBy: {
      id: 'asc'
    }
  });

  const nodeMap = new Map<number, CommentNode>();

  for (const comment of comments) {
    nodeMap.set(comment.id, {
      id: comment.id,
      content: comment.content,
      authorUsername: comment.author.username,
      parentId: comment.parentId,
      children: []
    });
  }

  const rootNodes: CommentNode[] = [];

  for (const comment of comments) {
    const node = nodeMap.get(comment.id)!;
    if (comment.parentId === null) {
      rootNodes.push(node);
    } else {
      const parentNode = nodeMap.get(comment.parentId);
      if (parentNode) {
        parentNode.children.push(node);
      } else {
        rootNodes.push(node);
      }
    }
  }

  const sortChildren = (node: CommentNode) => {
    node.children.sort((a, b) => a.id - b.id);
    node.children.forEach(sortChildren);
  };

  rootNodes.sort((a, b) => a.id - b.id);
  rootNodes.forEach(sortChildren);

  return rootNodes;
};
