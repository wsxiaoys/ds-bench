import type { GetDocuments, GetAuditLogs } from "wasp/server/operations";
import type { Document, AuditLog } from "wasp/entities";
import { HttpError } from "wasp/server";

export const getDocuments: GetDocuments<
  void,
  (Document & { owner: { id: number; role: string } })[]
> = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Authentication required");
  }
  // All authenticated users (ANALYST, MANAGER, ADMIN) can view documents
  return context.entities.Document.findMany({
    include: { owner: true },
  });
};

export const getAuditLogs: GetAuditLogs<
  void,
  (AuditLog & { user: { id: number; role: string } })[]
> = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Authentication required");
  }
  // Only ADMIN can view audit logs
  if (context.user.role !== "ADMIN") {
    throw new HttpError(403, "Only ADMIN users can view audit logs");
  }
  return context.entities.AuditLog.findMany({
    include: { user: true },
    orderBy: { timestamp: "desc" },
  });
};
