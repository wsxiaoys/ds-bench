import { HttpError } from "wasp/server";

export const getDocuments = async (_args: void, context: any) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }
  return context.entities.Document.findMany({
    orderBy: { id: "asc" },
  });
};

export const getAuditLogs = async (_args: void, context: any) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }
  if (context.user.role !== "ADMIN") {
    throw new HttpError(403, "Forbidden");
  }
  return context.entities.AuditLog.findMany({
    orderBy: { id: "desc" },
  });
};
