import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'

export const Route = createFileRoute('/')({
  component: Home,
})

type FileMetadata = {
  id: number
  filename: string
  size: number
  mime: string
  uploadedAt: string
}

function Home() {
  const [files, setFiles] = useState<FileMetadata[]>([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchFiles = async () => {
    try {
      const res = await fetch('/api/files')
      if (res.ok) {
        const data = await res.json()
        setFiles(data)
      }
    } catch (err) {
      console.error('Failed to fetch files', err)
    }
  }

  useEffect(() => {
    fetchFiles()
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0])
      setError(null)
    } else {
      setSelectedFile(null)
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile) {
      setError('No file selected')
      return
    }

    setError(null)
    setLoading(true)

    const formData = new FormData()
    formData.append('file', selectedFile)

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (res.status === 201) {
        const newFile = await res.json()
        setFiles((prev) => [newFile, ...prev])
        setSelectedFile(null)
        // Reset file input element value
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
        if (fileInput) {
          fileInput.value = ''
        }
      } else {
        const data = await res.json()
        setError(data.error || 'Upload failed')
      }
    } catch (err: any) {
      setError(err.message || 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/files/${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setFiles((prev) => prev.filter((f) => f.id !== id))
      } else {
        alert('Failed to delete file')
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete file')
    }
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem', fontFamily: 'sans-serif' }}>
      <header style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <h1 style={{ color: '#333' }}>Local Image Upload Gallery</h1>
        <p style={{ color: '#666' }}>Upload images (PNG, JPEG, GIF, WEBP) up to 2 MiB</p>
      </header>

      <section style={{ background: '#f9f9f9', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <input
              type="file"
              data-testid="file-input"
              accept="image/png, image/jpeg, image/gif, image/webp"
              onChange={handleFileChange}
              style={{
                padding: '0.5rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
                background: '#fff',
                cursor: 'pointer'
              }}
            />
            <button
              type="submit"
              data-testid="upload-button"
              disabled={loading}
              style={{
                padding: '0.6rem 1.2rem',
                background: loading ? '#ccc' : '#0070f3',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
                transition: 'background 0.2s'
              }}
            >
              {loading ? 'Uploading...' : 'Upload File'}
            </button>
          </div>

          {error && (
            <div
              data-testid="upload-error"
              style={{
                color: '#d32f2f',
                background: '#fffeeb',
                padding: '0.75rem',
                borderRadius: '4px',
                border: '1px solid #ffcdd2',
                fontWeight: '500'
              }}
            >
              {error}
            </div>
          )}
        </form>
      </section>

      <section>
        <h2 style={{ color: '#444', borderBottom: '2px solid #eaeaea', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>Gallery</h2>
        
        {files.length === 0 ? (
          <p style={{ color: '#888', textAlign: 'center', padding: '2rem' }}>No files uploaded yet.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.5rem' }}>
            {files.map((file) => (
              <div
                key={file.id}
                data-testid="gallery-item"
                data-file-id={file.id}
                style={{
                  border: '1px solid #e1e1e1',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  background: '#fff',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
              >
                <div style={{ height: '150px', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  <img
                    src={`/api/files/${file.id}`}
                    alt={file.filename}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      // Fallback for non-image or broken files
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%23999" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
                    }}
                  />
                </div>
                <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flexGrow: 1 }}>
                  <div
                    data-testid="file-name"
                    style={{
                      fontWeight: 'bold',
                      fontSize: '0.95rem',
                      color: '#333',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={file.filename}
                  >
                    {file.filename}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#777' }}>
                    {(file.size / 1024).toFixed(1)} KiB • {file.mime.split('/')[1].toUpperCase()}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '0.5rem' }}>
                    <a
                      data-testid="file-link"
                      href={`/api/files/${file.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: '0.85rem',
                        color: '#0070f3',
                        textDecoration: 'none',
                        fontWeight: '500'
                      }}
                    >
                      View Raw
                    </a>
                    <button
                      data-testid="delete-button"
                      onClick={() => handleDelete(file.id)}
                      style={{
                        padding: '0.4rem 0.8rem',
                        background: '#ff4d4f',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: '500',
                        transition: 'background 0.2s'
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
