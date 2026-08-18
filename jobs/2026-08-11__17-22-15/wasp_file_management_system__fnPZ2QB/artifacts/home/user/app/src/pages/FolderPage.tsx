import { useState } from 'react';
import { useParams, Link } from 'react-router';
import { useQuery, getFolderContents, getFolderBreadcrumbs } from 'wasp/client/operations';
import { createFolder, createShareLink } from 'wasp/client/operations';
import { api } from 'wasp/client/api';
import { Layout } from '../components/Layout';

export function FolderPage() {
  const { folderId } = useParams();
  const parsedFolderId = folderId ? parseInt(folderId, 10) : null;

  // Queries
  const { data: contents, refetch: refetchContents } = useQuery(getFolderContents, { folderId: parsedFolderId });
  const { data: breadcrumbs } = useQuery(getFolderBreadcrumbs, { folderId: parsedFolderId });

  // State for Create Folder
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  // State for File Upload
  const [uploadFileObj, setUploadFileObj] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // State for Share Modal/Form
  const [sharingFile, setSharingFile] = useState<any | null>(null);
  const [sharePassword, setSharePassword] = useState('');
  const [shareExpires, setShareExpires] = useState('');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [creatingLink, setCreatingLink] = useState(false);

  // Handlers
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      await createFolder({ name: newFolderName, parentId: parsedFolderId });
      setNewFolderName('');
      refetchContents();
    } catch (err) {
      console.error('Error creating folder', err);
      alert('Failed to create folder');
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleUploadFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFileObj) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFileObj);
      if (parsedFolderId) {
        formData.append('folderId', String(parsedFolderId));
      }

      await api.post('/api/upload', { body: formData });
      setUploadFileObj(null);
      // Reset input element
      const fileInput = document.getElementById('file-upload-input-el') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      refetchContents();
    } catch (err) {
      console.error('Error uploading file', err);
      alert('Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleCreateShareLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sharingFile) return;
    setCreatingLink(true);
    try {
      const expiresInMinutes = shareExpires ? parseInt(shareExpires, 10) : undefined;
      const shareLink = await createShareLink({
        fileId: sharingFile.id,
        password: sharePassword || undefined,
        expiresInMinutes,
      });

      const fullLink = `${window.location.origin}/share/${shareLink.id}`;
      setGeneratedLink(fullLink);
    } catch (err) {
      console.error('Error creating share link', err);
      alert('Failed to create share link');
    } finally {
      setCreatingLink(false);
    }
  };

  const openShareForm = (file: any) => {
    setSharingFile(file);
    setSharePassword('');
    setShareExpires('');
    setGeneratedLink(null);
  };

  return (
    <Layout>
      {/* Breadcrumb Trail */}
      <div style={{ marginBottom: '20px', fontSize: '16px', color: '#495057', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>Breadcrumbs:</span>
        <Link to="/" style={{ color: '#007bff', textDecoration: 'none', fontWeight: 'bold' }}>Root</Link>
        {breadcrumbs && breadcrumbs.map((crumb: any) => (
          <span key={crumb.id}>
            &gt;{' '}
            <Link to={`/folder/${crumb.id}`} style={{ color: '#007bff', textDecoration: 'none' }}>
              {crumb.name}
            </Link>
          </span>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
        {/* Create Folder Form */}
        <div style={{ padding: '20px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 15px 0' }}>Create Folder</h3>
          <form onSubmit={handleCreateFolder}>
            <input
              type="text"
              placeholder="Folder Name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              data-testid="folder-name-input"
              style={{ width: '100%', padding: '8px', marginBottom: '10px', boxSizing: 'border-box', border: '1px solid #ced4da', borderRadius: '4px' }}
              disabled={creatingFolder}
            />
            <button
              type="submit"
              data-testid="create-folder-btn"
              style={{ padding: '8px 16px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              disabled={creatingFolder}
            >
              {creatingFolder ? 'Creating...' : 'Create Folder'}
            </button>
          </form>
        </div>

        {/* Upload File Form */}
        <div style={{ padding: '20px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 15px 0' }}>Upload File</h3>
          <form onSubmit={handleUploadFile}>
            <input
              id="file-upload-input-el"
              type="file"
              onChange={(e) => setUploadFileObj(e.target.files?.[0] || null)}
              data-testid="file-upload-input"
              style={{ width: '100%', marginBottom: '10px' }}
              disabled={uploading}
            />
            <button
              type="submit"
              data-testid="upload-file-btn"
              style={{ padding: '8px 16px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              disabled={uploading || !uploadFileObj}
            >
              {uploading ? 'Uploading...' : 'Upload File'}
            </button>
          </form>
        </div>
      </div>

      {/* Folders List */}
      <div style={{ marginBottom: '30px' }}>
        <h3 style={{ borderBottom: '2px solid #dee2e6', paddingBottom: '8px', marginBottom: '15px' }}>Folders</h3>
        {contents?.folders && contents.folders.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px' }}>
            {contents.folders.map((folder: any) => (
              <div key={folder.id} style={{ padding: '15px', backgroundColor: 'white', border: '1px solid #dee2e6', borderRadius: '6px', display: 'flex', alignItems: 'center' }}>
                <span style={{ marginRight: '8px', fontSize: '20px' }}>📁</span>
                <Link
                  to={`/folder/${folder.id}`}
                  data-testid={`folder-link-${folder.id}`}
                  className="folder-link"
                  style={{ color: '#212529', textDecoration: 'none', fontWeight: '500', wordBreak: 'break-all' }}
                >
                  {folder.name}
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: '#6c757d', italic: 'true' } as any}>No folders in this directory.</p>
        )}
      </div>

      {/* Files List */}
      <div style={{ marginBottom: '30px' }}>
        <h3 style={{ borderBottom: '2px solid #dee2e6', paddingBottom: '8px', marginBottom: '15px' }}>Files</h3>
        {contents?.files && contents.files.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {contents.files.map((file: any) => (
              <div
                key={file.id}
                data-testid={`file-item-${file.id}`}
                className="file-item"
                style={{ padding: '12px 20px', backgroundColor: 'white', border: '1px solid #dee2e6', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '20px' }}>📄</span>
                  <div>
                    <strong style={{ display: 'block', color: '#212529' }}>{file.name}</strong>
                    <span style={{ fontSize: '12px', color: '#6c757d' }}>
                      {(file.size / 1024).toFixed(2)} KB | {new Date(file.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => openShareForm(file)}
                  data-testid={`share-btn-${file.id}`}
                  className="share-btn"
                  style={{ padding: '6px 12px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Share
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: '#6c757d', italic: 'true' } as any}>No files uploaded yet.</p>
        )}
      </div>

      {/* Share Modal / Form */}
      {sharingFile && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '8px', maxWidth: '500px', width: '100%', boxSizing: 'border-box' }}>
            <h3 style={{ margin: '0 0 15px 0' }}>Share File: {sharingFile.name}</h3>
            <form onSubmit={handleCreateShareLink}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Password Protection (Optional):</label>
                <input
                  type="password"
                  placeholder="Enter password"
                  value={sharePassword}
                  onChange={(e) => setSharePassword(e.target.value)}
                  data-testid="share-password-input"
                  style={{ width: '100%', padding: '8px', boxSizing: 'border-box', border: '1px solid #ced4da', borderRadius: '4px' }}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Expires In (Minutes, Optional):</label>
                <input
                  type="number"
                  placeholder="e.g. 60"
                  value={shareExpires}
                  onChange={(e) => setShareExpires(e.target.value)}
                  data-testid="share-expires-input"
                  style={{ width: '100%', padding: '8px', boxSizing: 'border-box', border: '1px solid #ced4da', borderRadius: '4px' }}
                />
              </div>
              <button
                type="submit"
                data-testid="create-share-link-btn"
                style={{ padding: '8px 16px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '10px' }}
                disabled={creatingLink}
              >
                {creatingLink ? 'Creating...' : 'Create Share Link'}
              </button>
              <button
                type="button"
                onClick={() => setSharingFile(null)}
                style={{ padding: '8px 16px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </form>

            {generatedLink && (
              <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#e9ecef', borderRadius: '6px' }}>
                <strong style={{ display: 'block', marginBottom: '5px' }}>Sharing Link:</strong>
                <div
                  data-testid="share-link-display"
                  style={{ wordBreak: 'break-all', fontFamily: 'monospace', padding: '8px', backgroundColor: 'white', border: '1px solid #ced4da', borderRadius: '4px' }}
                >
                  {generatedLink}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
