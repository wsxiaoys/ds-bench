import type {
  CreateDocument,
  UpdateDocument,
  DeleteDocument,
} from "wasp/server/operations";
import { HttpError } from "wasp/server";

export const createDocument: CreateDocument<
  { title: string; content: string },
  void
> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Authentication required");
  }
  // Only MANAGER and ADMIN can create documents
  if (context.user.role !== "MANAGER" && context.user.role !== "ADMIN") {
    throw new HttpError(403, "Only MANAGER and ADMIN users can create documents");
  }

  const doc = await context.entities.Document.create({
    data: {
      title: args.title,
      content: args.content,
      ownerId: context.user.id,
    },
  });

  // Create audit log entry
  await context.entities.AuditLog.create({
    data: {
      action: "CREATE",
      entityName: "Document",
      entityId: doc.id,
      userId: context.user.id,
      payload: JSON.stringify({ title: args.title, content: args.content }),
    },
  });
};

export const updateDocument: UpdateDocument<
  { id: number; title: string; content: string },
  void
> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Authentication required");
  }
  // Only MANAGER and ADMIN can update documents
  if (context.user.role !== "MANAGER" && context.user.role !== "ADMIN") {
    throw new HttpError(403, "Only MANAGER and ADMIN users can update documents");
  }

  await context.entities.Document.update({
    where: { id: args.id },
    data: {
      title: args.title,
      content: args.content,
    },
  });

  // Create audit log entry
  await context.entities.AuditLog.create({
    data: {
      action: "UPDATE",
      entityName: "Document",
      entityId: args.id,
      userId: context.user.id,
      payload: JSON.stringify({ title: args.title, content: args.content }),
    },
  });
};

export const deleteDocument: DeleteDocument<{ id: number }, void> = async (
  args,
  context
) => {
  if (!context.user) {
    throw new HttpError(401, "Authentication required");
  }
  // Only ADMIN can delete documents
  if (context.user.role !== "ADMIN") {
    throw new HttpError(403, "Only ADMIN users can delete documents");
  }

  await context.entities.Document.delete({
    where: { id: args.id },
  });

  // Create audit log entry
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
