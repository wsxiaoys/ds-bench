import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'

export const Route = createFileRoute('/')({ component: Home })

interface FileItem {
  id: number
  filename: string
  size: number
  mime: string
  uploadedAt: string
}

function Home() {
  const [files, setFiles] = useState<FileItem[]>([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const fetchFiles = async () => {
    try {
      const res = await fetch('/api/files')
      if (res.ok) {
        const data = await res.json()
        setFiles(data)
      }
    } catch (err) {
      console.error('Error fetching files:', err)
    }
  }

  useEffect(() => {
    fetchFiles()
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0])
      setError(null) // Clear error on new file selection
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file first.')
      return
    }

    setIsUploading(true)
    setError(null)

    const formData = new FormData()
    formData.append('file', selectedFile)

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (res.status === 201) {
        setSelectedFile(null)
        // Reset file input element if possible
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
        if (fileInput) fileInput.value = ''
        await fetchFiles()
      } else {
        const data = await res.json()
        setError(data.error || 'Upload failed')
      }
    } catch (err) {
      setError('An error occurred during upload.')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/files/${id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        await fetchFiles()
      } else {
        console.error('Failed to delete file')
      }
    } catch (err) {
      console.error('Error deleting file:', err)
    }
  }

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1>Image Upload Gallery</h1>

      <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ccc', borderRadius: '5px' }}>
        <h2>Upload New Image</h2>
        <input
          type="file"
          data-testid="file-input"
          onChange={handleFileChange}
          style={{ marginBottom: '10px', display: 'block' }}
        />
        <button
          data-testid="upload-button"
          onClick={handleUpload}
          disabled={isUploading}
          style={{ padding: '8px 15px', cursor: 'pointer' }}
        >
          {isUploading ? 'Uploading...' : 'Upload'}
        </button>

        {error && (
          <div
            data-testid="upload-error"
            style={{ color: 'red', marginTop: '10px', fontWeight: 'bold' }}
          >
            {error}
          </div>
        )}
      </div>

      <div>
        <h2>Gallery</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {files.map((file) => (
            <div
              key={file.id}
              data-testid="gallery-item"
              data-file-id={file.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px',
                border: '1px solid #eee',
                borderRadius: '5px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                {file.mime.startsWith('image/') && (
                  <img
                    src={`/api/files/${file.id}`}
                    alt={file.filename}
                    style={{ maxWidth: '100px', maxHeight: '100px', objectFit: 'contain' }}
                  />
                )}
                <div>
                  <div data-testid="file-name" style={{ fontWeight: 'bold' }}>
                    {file.filename}
                  </div>
                  <div style={{ fontSize: '0.85em', color: '#666' }}>
                    {(file.size / 1024).toFixed(2)} KB | {file.mime} | {new Date(file.uploadedAt).toLocaleString()}
                  </div>
                  <a
                    data-testid="file-link"
                    href={`/api/files/${file.id}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: '0.9em', color: '#0066cc', textDecoration: 'none' }}
                  >
                    View Full File
                  </a>
                </div>
              </div>
              <button
                data-testid="delete-button"
                onClick={() => handleDelete(file.id)}
                style={{
                  padding: '5px 10px',
                  backgroundColor: '#ff4d4d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                }}
              >
                Delete
              </button>
            </div>
          ))}
          {files.length === 0 && <p>No images uploaded yet.</p>}
        </div>
      </div>
    </div>
  )
}
