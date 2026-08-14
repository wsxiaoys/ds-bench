import { HttpError } from "wasp/server";
import type { GetDocuments, GetAuditLogs } from "wasp/server/operations";
import { Document, AuditLog } from "wasp/entities";

export const getDocuments: GetDocuments<void, Document[]> = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }
  return context.entities.Document.findMany({
    orderBy: { id: "asc" },
  });
};

export const getAuditLogs: GetAuditLogs<void, AuditLog[]> = async (_args, context) => {
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
