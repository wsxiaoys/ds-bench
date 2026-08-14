import React from "react";
import { useParams } from "react-router";
import { Dashboard } from "./Dashboard";

export function FolderPage() {
  const { folderId } = useParams<{ folderId: string }>();
  return <Dashboard folderId={folderId} />;
}
