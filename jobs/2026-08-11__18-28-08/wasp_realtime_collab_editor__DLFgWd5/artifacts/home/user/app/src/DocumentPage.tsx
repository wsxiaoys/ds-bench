import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router'
import { useQuery, getDocument, saveVersion, restoreVersion, shareDocument, revokePermission } from 'wasp/client/operations'
import { useSocket, useSocketListener } from 'wasp/client/webSocket'

export function DocumentPage() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading, error, refetch } = useQuery(getDocument, { id: Number(id) })
  const [content, setContent] = useState('')
  const [shareUsername, setShareUsername] = useState('')
  const [shareRole, setShareRole] = useState('VIEW')

  const { socket } = useSocket()

  // Join the document room on mount/id change
  useEffect(() => {
    if (socket && id) {
      socket.emit('joinDocument', { documentId: id })
    }
    return () => {
      if (socket && id) {
        socket.emit('leaveDocument', { documentId: id })
      }
    }
  }, [socket, id])

  // Sync content with database on load or when query refetches (e.g. after save/restore)
  useEffect(() => {
    if (data) {
      setContent(data.document.content)
    }
  }, [data])

  // Real-time synchronization listeners
  useSocketListener('documentEdited', ({ content: newContent }: { content: string }) => {
    setContent(newContent)
  })

  useSocketListener('documentRestored', ({ content: restoredContent }: { content: string }) => {
    setContent(restoredContent)
    refetch()
  })

  useSocketListener('versionSaved', () => {
    refetch()
  })

  if (isLoading) {
    return <p style={{ textAlign: 'center', padding: '20px' }}>Loading document...</p>
  }

  if (error) {
    const err = error as any
    if (err.status === 403 || err.message?.includes('Access Denied')) {
      return (
        <div style={{ maxWidth: '600px', margin: '40px auto', padding: '20px', fontFamily: 'sans-serif', textAlign: 'center' }}>
          <h2 style={{ color: '#f44336' }}>Access Denied</h2>
          <p>You do not have permission to view or edit this document.</p>
          <Link to="/" style={{ color: '#2196F3', textDecoration: 'none', fontWeight: 'bold' }}>Back to Homepage</Link>
        </div>
      )
    }
    return <p style={{ textAlign: 'center', padding: '20px', color: 'red' }}>Error: {err.message || 'Failed to load document'}</p>
  }

  if (!data) {
    return <p style={{ textAlign: 'center', padding: '20px' }}>Document not found</p>
  }

  const { document: doc, userRole } = data
  const canEdit = userRole === 'OWNER' || userRole === 'EDIT'

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value
    setContent(newContent)
    if (socket && id) {
      socket.emit('editDocument', { documentId: id, content: newContent })
    }
  }

  const handleSaveVersion = async () => {
    try {
      await saveVersion({ documentId: Number(id), content })
    } catch (err: any) {
      alert(err.message || 'Failed to save version')
    }
  }

  const handleRestoreVersion = async (versionId: number) => {
    try {
      await restoreVersion({ documentId: Number(id), versionId })
    } catch (err: any) {
      alert(err.message || 'Failed to restore version')
    }
  }

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!shareUsername.trim()) return

    try {
      await shareDocument({
        documentId: Number(id),
        username: shareUsername,
        role: shareRole
      })
      setShareUsername('')
    } catch (err: any) {
      alert(err.message || 'Failed to share document')
    }
  }

  const handleRevoke = async (userId: number) => {
    try {
      await revokePermission({
        documentId: Number(id),
        userId
      })
    } catch (err: any) {
      alert(err.message || 'Failed to revoke permission')
    }
  }

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
        <div>
          <Link to="/" style={{ color: '#2196F3', textDecoration: 'none', fontSize: '14px' }}>&larr; Back to Documents</Link>
          <h1 style={{ margin: '10px 0 5px 0' }}>{doc.title}</h1>
          <small style={{ color: '#666' }}>
            Owner: {doc.owner.username} | Your Role: <strong>{userRole}</strong>
          </small>
        </div>
        {canEdit && (
          <button
            id="save-version-btn"
            onClick={handleSaveVersion}
            style={{ padding: '10px 20px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Save Version
          </button>
        )}
      </header>

      <section style={{ marginBottom: '30px' }}>
        <textarea
          id="document-content-textarea"
          value={content}
          onChange={handleTextareaChange}
          disabled={!canEdit}
          placeholder={canEdit ? "Type your content here..." : "You only have viewing permission."}
          style={{
            width: '100%',
            height: '350px',
            padding: '15px',
            fontSize: '16px',
            fontFamily: 'monospace',
            border: '1px solid #ccc',
            borderRadius: '4px',
            boxSizing: 'border-box',
            resize: 'vertical',
            backgroundColor: canEdit ? '#fff' : '#f9f9f9',
            color: '#333'
          }}
        />
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: userRole === 'OWNER' ? '1fr 1fr' : '1fr', gap: '30px' }}>
        {/* Version History */}
        <div>
          <h3>Version History</h3>
          <ul id="version-history-list" style={{ listStyle: 'none', padding: 0, maxHeight: '300px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '4px' }}>
            {doc.versions.length === 0 ? (
              <li style={{ padding: '15px', color: '#666', textAlign: 'center' }}>No saved versions yet.</li>
            ) : (
              doc.versions.map((version: any, index: number) => (
                <li
                  key={version.id}
                  style={{
                    padding: '12px',
                    borderBottom: '1px solid #eee',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: '#fff'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 'bold' }}>
                      Version #{index + 1} (ID: {version.id})
                    </span>
                    <span style={{ fontSize: '12px', color: '#666' }}>
                      Saved by: {version.author.username}
                    </span>
                    <span style={{ fontSize: '11px', color: '#888' }}>
                      {new Date(version.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {canEdit && (
                    <button
                      className="restore-version-btn"
                      onClick={() => handleRestoreVersion(version.id)}
                      style={{
                        padding: '6px 12px',
                        background: '#FF9800',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 'bold'
                      }}
                    >
                      Restore
                    </button>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>

        {/* Sharing & Permissions (Owner only) */}
        {userRole === 'OWNER' && (
          <div>
            <h3>Share Document</h3>
            <form onSubmit={handleShare} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <input
                id="share-username-input"
                type="text"
                placeholder="Username"
                value={shareUsername}
                onChange={(e) => setShareUsername(e.target.value)}
                required
                style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
              <select
                id="share-role-select"
                value={shareRole}
                onChange={(e) => setShareRole(e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              >
                <option value="VIEW">VIEW</option>
                <option value="EDIT">EDIT</option>
              </select>
              <button
                id="share-document-btn"
                type="submit"
                style={{ padding: '8px 16px', background: '#2196F3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Share
              </button>
            </form>

            <h4>Shared Users</h4>
            <ul id="permissions-list" style={{ listStyle: 'none', padding: 0, border: '1px solid #eee', borderRadius: '4px' }}>
              {doc.permissions.length === 0 ? (
                <li style={{ padding: '15px', color: '#666', textAlign: 'center' }}>Not shared with anyone yet.</li>
              ) : (
                doc.permissions.map((p: any) => (
                  <li
                    key={p.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 12px',
                      borderBottom: '1px solid #eee'
                    }}
                  >
                    <span>
                      <strong>{p.user.username}</strong> ({p.role})
                    </span>
                    <button
                      onClick={() => handleRevoke(p.userId)}
                      style={{ padding: '4px 8px', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                    >
                      Revoke
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}
