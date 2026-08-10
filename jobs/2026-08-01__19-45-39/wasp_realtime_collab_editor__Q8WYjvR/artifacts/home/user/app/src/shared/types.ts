import type { SuperJSONValue } from "wasp/core/serialization";

export type Role = "OWNER" | "EDIT" | "VIEW";

// NOTE: These payload types are sent over the wire via Wasp's Queries/Actions
// (superjson) and via WebSocket events. They include a `SuperJSONValue`
// index signature so TypeScript structurally accepts them wherever Wasp
// expects a serializable `SuperJSONObject`-shaped payload.

export interface VersionDTO {
  [key: string]: SuperJSONValue;
  id: number;
  content: string;
  authorUsername: string;
  createdAt: Date;
}

export interface PermissionDTO {
  [key: string]: SuperJSONValue;
  id: number;
  userId: number;
  username: string;
  role: string;
}

export interface DocumentListItem {
  [key: string]: SuperJSONValue;
  id: number;
  title: string;
  updatedAt: Date;
  isOwner: boolean;
  role: Role;
  ownerUsername: string;
}

export interface DocumentDetails {
  [key: string]: SuperJSONValue;
  id: number;
  title: string;
  content: string;
  isOwner: boolean;
  role: Role;
  canEdit: boolean;
  ownerUsername: string;
  versions: VersionDTO[];
  permissions: PermissionDTO[];
}

export interface CreateDocumentResult {
  [key: string]: SuperJSONValue;
  id: number;
}

export interface SaveVersionResult {
  [key: string]: SuperJSONValue;
  version: VersionDTO;
}

export interface RestoreVersionResult {
  [key: string]: SuperJSONValue;
  content: string;
}

export interface PermissionsResult {
  [key: string]: SuperJSONValue;
  permissions: PermissionDTO[];
}
