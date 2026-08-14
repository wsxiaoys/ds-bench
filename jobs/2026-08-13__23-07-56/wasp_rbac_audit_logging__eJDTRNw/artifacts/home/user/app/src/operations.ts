import { HttpError } from "wasp/server";
import type {
  GetDocuments,
  GetAuditLogs,
  CreateDocument,
  UpdateDocument,
  DeleteDocument,
} from "wasp/server/operations";

export const getDocuments: GetDocuments<void, any> = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  return context.entities.Document.findMany({
    include: {
      owner: true,
    },
  });
};

export const getAuditLogs: GetAuditLogs<void, any> = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  if (context.user.role !== "ADMIN") {
    throw new HttpError(403, "Access denied. Only ADMINs can view audit logs.");
  }
  return context.entities.AuditLog.findMany({
    orderBy: { timestamp: "desc" },
  });
};

export const createDocument: CreateDocument<
  { title: string; content: string },
  any
> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  const role = context.user.role;
  if (role !== "MANAGER" && role !== "ADMIN") {
    throw new HttpError(
      403,
      "Access denied. Only MANAGERs and ADMINs can create documents."
    );
  }

  const document = await context.entities.Document.create({
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
      entityId: document.id,
      userId: context.user.id,
      payload: JSON.stringify({ title: args.title, content: args.content }),
    },
  });

  return document;
};

export const updateDocument: UpdateDocument<
  { id: number; title: string; content: string },
  any
> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  const role = context.user.role;
  if (role !== "MANAGER" && role !== "ADMIN") {
    throw new HttpError(
      403,
      "Access denied. Only MANAGERs and ADMINs can update documents."
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

export const deleteDocument: DeleteDocument<{ id: number }, any> = async (
  args,
  context
) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  const role = context.user.role;
  if (role !== "ADMIN") {
    throw new HttpError(
      403,
      "Access denied. Only ADMINs can delete documents."
    );
  }

  const document = await context.entities.Document.delete({
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

  return document;
};
