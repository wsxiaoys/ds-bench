interface GetCommentTreeArgs {
  postId: number;
}

interface CommentNode {
  id: number;
  content: string;
  authorUsername: string;
  parentId: number | null;
  children: CommentNode[];
}

export const getPosts = async (args: any, context: any) => {
  return context.entities.Post.findMany({
    select: {
      id: true,
      title: true
    }
  });
};

export const getCommentTree = async (args: GetCommentTreeArgs, context: any): Promise<CommentNode[]> => {
  const postId = typeof args.postId === 'string' ? parseInt(args.postId, 10) : args.postId;

  const comments = await context.entities.Comment.findMany({
    where: { postId },
    include: {
      author: {
        select: { username: true }
      }
    },
    orderBy: { id: 'asc' }
  });

  const nodesMap = new Map<number, CommentNode>();
  for (const c of comments) {
    nodesMap.set(c.id, {
      id: c.id,
      content: c.content,
      authorUsername: c.author.username,
      parentId: c.parentId,
      children: []
    });
  }

  const rootNodes: CommentNode[] = [];
  for (const c of comments) {
    const node = nodesMap.get(c.id)!;
    if (c.parentId === null || c.parentId === undefined) {
      rootNodes.push(node);
    } else {
      const parentNode = nodesMap.get(c.parentId);
      if (parentNode) {
        parentNode.children.push(node);
      } else {
        rootNodes.push(node);
      }
    }
  }

  return rootNodes;
};
