import { HttpError } from "wasp/server";

export const createDocument = async (
  args: { title: string; content: string },
  context: any
) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }
  if (context.user.role !== "ADMIN" && context.user.role !== "MANAGER") {
    throw new HttpError(403, "Forbidden");
  }
  const { title, content } = args;
  if (!title || !content) {
    throw new HttpError(400, "Title and content are required");
  }

  const document = await context.entities.Document.create({
    data: {
      title,
      content,
      ownerId: context.user.id,
    },
  });

  await context.entities.AuditLog.create({
    data: {
      action: "CREATE",
      entityName: "Document",
      entityId: document.id,
      userId: context.user.id,
      payload: JSON.stringify({ title, content }),
    },
  });

  return document;
};

export const updateDocument = async (
  args: { id: number; title: string; content: string },
  context: any
) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }
  if (context.user.role !== "ADMIN" && context.user.role !== "MANAGER") {
    throw new HttpError(403, "Forbidden");
  }
  const { id, title, content } = args;

  const existingDoc = await context.entities.Document.findUnique({
    where: { id },
  });
  if (!existingDoc) {
    throw new HttpError(404, "Document not found");
  }

  const updatedDoc = await context.entities.Document.update({
    where: { id },
    data: {
      title,
      content,
    },
  });

  await context.entities.AuditLog.create({
    data: {
      action: "UPDATE",
      entityName: "Document",
      entityId: id,
      userId: context.user.id,
      payload: JSON.stringify({ title, content }),
    },
  });

  return updatedDoc;
};

export const deleteDocument = async (args: { id: number }, context: any) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }
  if (context.user.role !== "ADMIN") {
    throw new HttpError(403, "Forbidden");
  }
  const { id } = args;

  const existingDoc = await context.entities.Document.findUnique({
    where: { id },
  });
  if (!existingDoc) {
    throw new HttpError(404, "Document not found");
  }

  await context.entities.Document.delete({
    where: { id },
  });

  await context.entities.AuditLog.create({
    data: {
      action: "DELETE",
      entityName: "Document",
      entityId: id,
      userId: context.user.id,
      payload: JSON.stringify({ id }),
    },
  });

  return { success: true };
};
