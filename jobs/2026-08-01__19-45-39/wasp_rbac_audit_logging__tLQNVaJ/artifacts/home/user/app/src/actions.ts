import { HttpError } from "wasp/server";
import type {
  CreateDocument,
  UpdateDocument,
  DeleteDocument,
} from "wasp/server/operations";
import type { Document } from "wasp/entities";

type CreateDocumentInput = {
  title: string;
  content: string;
};

type UpdateDocumentInput = {
  id: number;
  title: string;
  content: string;
};

type DeleteDocumentInput = {
  id: number;
};

export const createDocument: CreateDocument<
  CreateDocumentInput,
  Document
> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  if (context.user.role !== "MANAGER" && context.user.role !== "ADMIN") {
    throw new HttpError(
      403,
      "Only MANAGER and ADMIN users can create documents.",
    );
  }

  const document = await context.entities.Document.create({
    data: {
      title: args.title,
      content: args.content,
      owner: { connect: { id: context.user.id } },
    },
  });

  await context.entities.AuditLog.create({
    data: {
      action: "CREATE",
      entityName: "Document",
      entityId: document.id,
      userId: context.user.id,
      payload: JSON.stringify({ title: args.title, content: args.content }),
    },
  });

  return document;
};

export const updateDocument: UpdateDocument<
  UpdateDocumentInput,
  Document
> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  if (context.user.role !== "MANAGER" && context.user.role !== "ADMIN") {
    throw new HttpError(
      403,
      "Only MANAGER and ADMIN users can update documents.",
    );
  }

  const document = await context.entities.Document.update({
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
      entityId: document.id,
      userId: context.user.id,
      payload: JSON.stringify({ title: args.title, content: args.content }),
    },
  });

  return document;
};

export const deleteDocument: DeleteDocument<
  DeleteDocumentInput,
  void
> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  if (context.user.role !== "ADMIN") {
    throw new HttpError(403, "Only ADMIN users can delete documents.");
  }

  await context.entities.Document.delete({
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
};
