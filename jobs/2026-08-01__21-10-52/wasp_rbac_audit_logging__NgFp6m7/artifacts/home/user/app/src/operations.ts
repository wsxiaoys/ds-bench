import { type GetDocuments, type GetAuditLogs, type CreateDocument, type UpdateDocument, type DeleteDocument } from "wasp/server/operations";
import { HttpError } from "wasp/server";

export const getDocuments: GetDocuments<void, any> = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }
  return context.entities.Document.findMany({
    orderBy: { id: "asc" },
  });
};

export const getAuditLogs: GetAuditLogs<void, any> = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }
  if (context.user.role !== "ADMIN") {
    throw new HttpError(403, "Forbidden");
  }
  return context.entities.AuditLog.findMany({
    orderBy: { timestamp: "desc" },
  });
};

export const createDocument: CreateDocument<{ title: string; content: string }, any> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }
  if (context.user.role !== "ADMIN" && context.user.role !== "MANAGER") {
    throw new HttpError(403, "Forbidden");
  }
  
  const doc = await context.entities.Document.create({
    data: {
      title: args.title,
      content: args.content,
      ownerId: context.user.id,
    },
  });

  await context.entities.AuditLog.create({
    data: {
      action: "CREATE",
      entityName: "Document",
      entityId: doc.id,
      userId: context.user.id,
      payload: JSON.stringify({ title: args.title, content: args.content }),
    },
  });

  return doc;
};

export const updateDocument: UpdateDocument<{ id: number; title: string; content: string }, any> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }
  if (context.user.role !== "ADMIN" && context.user.role !== "MANAGER") {
    throw new HttpError(403, "Forbidden");
  }

  const doc = await context.entities.Document.update({
    where: { id: args.id },
    data: {
      title: args.title,
      content: args.content,
    },
  });

  await context.entities.AuditLog.create({
    data: {
      action: "UPDATE",
      entityName: "Document",
      entityId: doc.id,
      userId: context.user.id,
      payload: JSON.stringify({ title: args.title, content: args.content }),
    },
  });

  return doc;
};

export const deleteDocument: DeleteDocument<{ id: number }, any> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }
  if (context.user.role !== "ADMIN") {
    throw new HttpError(403, "Forbidden");
  }

  const doc = await context.entities.Document.delete({
    where: { id: args.id },
  });

  await context.entities.AuditLog.create({
    data: {
      action: "DELETE",
      entityName: "Document",
      entityId: args.id,
      userId: context.user.id,
      payload: JSON.stringify({ id: args.id }),
    },
  });

  return doc;
};
