import { HttpError } from "wasp/server";
import type { Document } from "wasp/entities";
import type { CreateDocument, UpdateDocument, DeleteDocument } from "wasp/server/operations";

export const createDocument: CreateDocument<
  { title: string; content: string },
  Document
> = async ({ title, content }, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }
  if (context.user.role !== "MANAGER" && context.user.role !== "ADMIN") {
    throw new HttpError(403, "Forbidden");
  }

  const newDoc = await context.entities.Document.create({
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
      entityId: newDoc.id,
      userId: context.user.id,
      payload: JSON.stringify({ title, content }),
    },
  });

  return newDoc;
};

export const updateDocument: UpdateDocument<
  { id: number; title: string; content: string },
  Document
> = async ({ id, title, content }, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }
  if (context.user.role !== "MANAGER" && context.user.role !== "ADMIN") {
    throw new HttpError(403, "Forbidden");
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

export const deleteDocument: DeleteDocument<
  { id: number },
  Document
> = async ({ id }, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }
  if (context.user.role !== "ADMIN") {
    throw new HttpError(403, "Forbidden");
  }

  const deletedDoc = await context.entities.Document.delete({
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

  return deletedDoc;
};
