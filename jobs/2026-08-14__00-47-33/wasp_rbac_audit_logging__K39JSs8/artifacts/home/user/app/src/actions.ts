import { HttpError } from "wasp/server";
import type { CreateDocument, UpdateDocument, DeleteDocument } from "wasp/server/operations";
import { Document } from "wasp/entities";

type CreateDocumentArgs = { title: string; content: string };
type UpdateDocumentArgs = { id: number; title: string; content: string };
type DeleteDocumentArgs = { id: number };

export const createDocument: CreateDocument<CreateDocumentArgs, Document> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }
  if (context.user.role !== "MANAGER" && context.user.role !== "ADMIN") {
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

export const updateDocument: UpdateDocument<UpdateDocumentArgs, Document> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }
  if (context.user.role !== "MANAGER" && context.user.role !== "ADMIN") {
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

export const deleteDocument: DeleteDocument<DeleteDocumentArgs, Document> = async (args, context) => {
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
