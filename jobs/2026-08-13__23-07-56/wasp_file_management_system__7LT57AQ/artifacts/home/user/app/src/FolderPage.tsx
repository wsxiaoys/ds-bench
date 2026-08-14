import { useParams } from "react-router";
import { DriveView } from "./components/DriveView";

export function FolderPage() {
  const { folderId } = useParams();
  const parsedFolderId = folderId ? parseInt(folderId, 10) : null;

  return <DriveView currentFolderId={parsedFolderId} />;
}
