export interface PermissionLike {
  userId: number;
  role: string;
}

export interface DocumentLike {
  ownerId: number;
  permissions: PermissionLike[];
}

export interface AccessInfo {
  isOwner: boolean;
  permissionRole: "VIEW" | "EDIT" | null;
  canView: boolean;
  canEdit: boolean;
}

/**
 * Figures out whether a user can view/edit a document, based on document
 * ownership and any explicit `Permission` record for that user.
 */
export function computeAccess(doc: DocumentLike, userId: number): AccessInfo {
  const isOwner = doc.ownerId === userId;
  const permission = doc.permissions.find((p) => p.userId === userId);
  const permissionRole = permission ? (permission.role as "VIEW" | "EDIT") : null;
  const canView = isOwner || permission !== undefined;
  const canEdit = isOwner || permissionRole === "EDIT";

  return { isOwner, permissionRole, canView, canEdit };
}
