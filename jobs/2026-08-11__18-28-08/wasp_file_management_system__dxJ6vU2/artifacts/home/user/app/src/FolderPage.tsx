import { useParams } from "react-router";
import { Dashboard } from "./Dashboard";

export function FolderPage() {
  const { folderId } = useParams();
  const parsedId = folderId ? parseInt(folderId, 10) : null;

  return <Dashboard folderId={parsedId} />;
}
