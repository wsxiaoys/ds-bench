import { useParams } from "react-router";
import { Dashboard } from "../components/Dashboard";

export function FolderPage() {
  const { folderId } = useParams();
  return <Dashboard folderId={folderId} />;
}
