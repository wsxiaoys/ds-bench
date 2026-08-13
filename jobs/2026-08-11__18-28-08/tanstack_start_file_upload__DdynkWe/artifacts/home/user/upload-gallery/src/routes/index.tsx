import { useState, useEffect, useRef } from 'react'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: GalleryComponent,
})

interface FileMetadata {
  id: number
  filename: string
  size: number
  mime: string
  uploadedAt: string
}

function GalleryComponent() {
  const [files, setFiles] = useState<FileMetadata[]>([])
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch files on mount
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

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const fileInput = fileInputRef.current
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      setError('Please select a file first.')
      return
    }

    const file = fileInput.files[0]
    const formData = new FormData()
    formData.append('file', file)

    setUploading(true)
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (res.status === 201) {
        const newFile = await res.json()
        // Add new file to the top of the list
        setFiles((prev) => [newFile, ...prev])
        // Clear input
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      } else {
        const errData = await res.json()
        setError(errData.error || 'Upload failed')
      }
    } catch (err) {
      setError('An error occurred during upload.')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id: number) => {
    setError(null)
    try {
      const res = await fetch(`/api/files/${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        // Remove deleted file from state
        setFiles((prev) => prev.filter((f) => f.id !== id))
      } else {
        const errData = await res.json()
        setError(errData.error || 'Delete failed')
      }
    } catch (err) {
      setError('An error occurred during deletion.')
    }
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Image Upload Gallery</h1>

      <form onSubmit={handleUpload} style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ccc', borderRadius: '5px' }}>
        <div style={{ marginBottom: '10px' }}>
          <label htmlFor="file-input" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Select Image (PNG, JPEG, GIF, WebP - Max 2MB):
          </label>
          <input
            id="file-input"
            type="file"
            ref={fileInputRef}
            data-testid="file-input"
            accept="image/png, image/jpeg, image/gif, image/webp"
          />
        </div>

        <button
          type="submit"
          disabled={uploading}
          data-testid="upload-button"
          style={{
            padding: '8px 15px',
            backgroundColor: '#007bff',
            color: '#fff',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
          }}
        >
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
      </form>

      {error && (
        <div
          data-testid="upload-error"
          style={{
            padding: '10px',
            backgroundColor: '#f8d7da',
            color: '#721c24',
            border: '1px solid #f5c6cb',
            borderRadius: '3px',
            marginBottom: '20px',
          }}
        >
          {error}
        </div>
      )}

      <h2>Gallery</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px' }}>
        {files.length === 0 ? (
          <p>No images uploaded yet.</p>
        ) : (
          files.map((file) => (
            <div
              key={file.id}
              data-testid="gallery-item"
              data-file-id={file.id}
              style={{
                border: '1px solid #ddd',
                borderRadius: '5px',
                padding: '10px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                backgroundColor: '#f9f9f9',
              }}
            >
              <div style={{ marginBottom: '10px', textAlign: 'center' }}>
                <img
                  src={`/api/files/${file.id}`}
                  alt={file.filename}
                  style={{ maxWidth: '100%', maxHeight: '150px', objectFit: 'contain', borderRadius: '3px' }}
                />
              </div>
              <div>
                <div
                  data-testid="file-name"
                  style={{
                    fontWeight: 'bold',
                    wordBreak: 'break-all',
                    fontSize: '0.9rem',
                    marginBottom: '5px',
                  }}
                >
                  {file.filename}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '10px' }}>
                  {(file.size / 1024).toFixed(1)} KB | {file.mime}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <a
                    data-testid="file-link"
                    href={`/api/files/${file.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '0.9rem', color: '#007bff', textDecoration: 'none' }}
                  >
                    View Raw
                  </a>
                  <button
                    data-testid="delete-button"
                    onClick={() => handleDelete(file.id)}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#dc3545',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
