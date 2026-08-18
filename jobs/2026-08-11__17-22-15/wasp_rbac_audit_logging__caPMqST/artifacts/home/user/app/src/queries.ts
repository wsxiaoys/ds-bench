import { HttpError } from "wasp/server";
import type { Document, AuditLog } from "wasp/entities";
import type { GetDocuments, GetAuditLogs } from "wasp/server/operations";

export const getDocuments: GetDocuments<void, Document[]> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }
  return context.entities.Document.findMany({
    orderBy: { id: "asc" }
  });
};

export const getAuditLogs: GetAuditLogs<void, AuditLog[]> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }
  if (context.user.role !== "ADMIN") {
    throw new HttpError(403, "Forbidden");
  }
  return context.entities.AuditLog.findMany({
    orderBy: { timestamp: "desc" }
  });
};
