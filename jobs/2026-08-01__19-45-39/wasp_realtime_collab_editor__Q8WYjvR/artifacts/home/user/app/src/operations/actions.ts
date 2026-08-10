import { HttpError } from "wasp/server";
import {
  type CreateDocument,
  type SaveVersion,
  type RestoreVersion,
  type ShareDocument,
  type RevokePermission,
} from "wasp/server/operations";

import { computeAccess } from "../access";
import { documentRoom, getIO } from "../socketIO";
import type {
  CreateDocumentResult,
  PermissionDTO,
  PermissionsResult,
  RestoreVersionResult,
  SaveVersionResult,
  VersionDTO,
} from "../shared/types";

export const createDocument: CreateDocument<
  { title: string },
  CreateDocumentResult
> = async ({ title }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  const trimmedTitle = title?.trim();
  if (!trimmedTitle) {
    throw new HttpError(400, "Title is required");
  }

  const document = await context.entities.Document.create({
    data: {
      title: trimmedTitle,
      ownerId: context.user.id,
    },
  });

  return { id: document.id };
};

export const saveVersion: SaveVersion<
  { documentId: number; content: string },
  SaveVersionResult
> = async ({ documentId, content }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const doc = await context.entities.Document.findUnique({
    where: { id: documentId },
    include: { permissions: true },
  });
  if (!doc) {
    throw new HttpError(404, "Document not found");
  }

  const access = computeAccess(doc, context.user.id);
  if (!access.canEdit) {
    throw new HttpError(403, "You don't have permission to edit this document");
  }

  const version = await context.entities.Version.create({
    data: {
      documentId,
      content,
      authorId: context.user.id,
    },
    include: { author: true },
  });

  await context.entities.Document.update({
    where: { id: documentId },
    data: { content },
  });

  const versionDTO: VersionDTO = {
    id: version.id,
    content: version.content,
    authorUsername: version.author.username,
    createdAt: version.createdAt,
  };

  getIO()
    ?.to(documentRoom(documentId))
    .emit("versionSaved", { documentId, version: versionDTO, content });

  return { version: versionDTO };
};

export const restoreVersion: RestoreVersion<
  { documentId: number; versionId: number },
  RestoreVersionResult
> = async ({ documentId, versionId }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const doc = await context.entities.Document.findUnique({
    where: { id: documentId },
    include: { permissions: true },
  });
  if (!doc) {
    throw new HttpError(404, "Document not found");
  }

  const access = computeAccess(doc, context.user.id);
  if (!access.canEdit) {
    throw new HttpError(403, "You don't have permission to edit this document");
  }

  const version = await context.entities.Version.findUnique({
    where: { id: versionId },
  });
  if (!version || version.documentId !== documentId) {
    throw new HttpError(404, "Version not found");
  }

  await context.entities.Document.update({
    where: { id: documentId },
    data: { content: version.content },
  });

  getIO()
    ?.to(documentRoom(documentId))
    .emit("documentRestored", {
      documentId,
      content: version.content,
      versionId: version.id,
    });

  return { content: version.content };
};

export const shareDocument: ShareDocument<
  { documentId: number; username: string; role: string },
  PermissionsResult
> = async ({ documentId, username, role }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  if (role !== "VIEW" && role !== "EDIT") {
    throw new HttpError(400, "Role must be VIEW or EDIT");
  }

  const doc = await context.entities.Document.findUnique({
    where: { id: documentId },
  });
  if (!doc) {
    throw new HttpError(404, "Document not found");
  }
  if (doc.ownerId !== context.user.id) {
    throw new HttpError(403, "Only the owner can share this document");
  }

  const trimmedUsername = username?.trim();
  if (!trimmedUsername) {
    throw new HttpError(400, "Username is required");
  }

  const targetUser = await context.entities.User.findUnique({
    where: { username: trimmedUsername },
  });
  if (!targetUser) {
    throw new HttpError(404, "User not found");
  }
  if (targetUser.id === context.user.id) {
    throw new HttpError(400, "You cannot share a document with yourself");
  }

  await context.entities.Permission.upsert({
    where: {
      documentId_userId: {
        documentId,
        userId: targetUser.id,
      },
    },
    update: { role },
    create: { documentId, userId: targetUser.id, role },
  });

  const permissionRecords = await context.entities.Permission.findMany({
    where: { documentId },
    include: { user: true },
  });
  const permissions: PermissionDTO[] = permissionRecords.map((p) => ({
    id: p.id,
    userId: p.userId,
    username: p.user.username,
    role: p.role,
  }));

  getIO()
    ?.to(documentRoom(documentId))
    .emit("permissionsChanged", { documentId, permissions });

  return { permissions };
};

export const revokePermission: RevokePermission<
  { documentId: number; permissionId: number },
  PermissionsResult
> = async ({ documentId, permissionId }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const doc = await context.entities.Document.findUnique({
    where: { id: documentId },
  });
  if (!doc) {
    throw new HttpError(404, "Document not found");
  }
  if (doc.ownerId !== context.user.id) {
    throw new HttpError(403, "Only the owner can revoke access");
  }

  await context.entities.Permission.deleteMany({
    where: { id: permissionId, documentId },
  });

  const permissionRecords = await context.entities.Permission.findMany({
    where: { documentId },
    include: { user: true },
  });
  const permissions: PermissionDTO[] = permissionRecords.map((p) => ({
    id: p.id,
    userId: p.userId,
    username: p.user.username,
    role: p.role,
  }));

  getIO()
    ?.to(documentRoom(documentId))
    .emit("permissionsChanged", { documentId, permissions });

  return { permissions };
};
