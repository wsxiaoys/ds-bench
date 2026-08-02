import { HttpError } from "wasp/server";
import type { GetDocuments, GetAuditLogs } from "wasp/server/operations";
import type { Document, AuditLog } from "wasp/entities";

export const getDocuments: GetDocuments<void, Document[]> = async (
  _args,
  context,
) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  return context.entities.Document.findMany({
    orderBy: { id: "asc" },
  });
};

export const getAuditLogs: GetAuditLogs<void, AuditLog[]> = async (
  _args,
  context,
) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  if (context.user.role !== "ADMIN") {
    throw new HttpError(403, "Only ADMIN users can view audit logs.");
  }

  return context.entities.AuditLog.findMany({
    orderBy: { id: "asc" },
  });
};
