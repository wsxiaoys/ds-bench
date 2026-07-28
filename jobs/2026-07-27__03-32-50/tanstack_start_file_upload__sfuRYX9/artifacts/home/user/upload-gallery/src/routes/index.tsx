import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'

interface FileMeta {
  id: number
  filename: string
  size: number
  mime: string
  uploadedAt: string
}

export const Route = createFileRoute('/')({
  component: Home,
})

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function Home() {
  const [files, setFiles] = React.useState<Array<FileMeta>>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [uploading, setUploading] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const loadFiles = React.useCallback(async () => {
    try {
      const res = await fetch('/api/files')
      if (res.ok) {
        const data = (await res.json()) as Array<FileMeta>
        setFiles(data)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadFiles()
  }, [loadFiles])

  async function handleUpload() {
    setError('')
    const input = fileInputRef.current
    const file = input?.files?.[0]
    if (!file) {
      setError('Please choose a file to upload first.')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(
          typeof data?.error === 'string' ? data.error : 'Upload failed.',
        )
        return
      }
      setFiles((prev) => [data as FileMeta, ...prev])
      if (input) input.value = ''
    } catch {
      setError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(id: number) {
    const res = await fetch(`/api/files/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setFiles((prev) => prev.filter((f) => f.id !== id))
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Image Upload Gallery</h1>

      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <input
          ref={fileInputRef}
          type="file"
          data-testid="file-input"
          accept="image/png,image/jpeg,image/gif,image/webp"
        />
        <button
          type="button"
          data-testid="upload-button"
          onClick={handleUpload}
          disabled={uploading}
          className="px-4 py-2 bg-blue-600 text-white rounded-sm disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
      </div>

      {error ? (
        <div data-testid="upload-error" role="alert" className="text-red-600 mb-4">
          {error}
        </div>
      ) : null}

      <hr className="my-4" />

      {loading ? (
        <p>Loading…</p>
      ) : files.length === 0 ? (
        <p>No files uploaded yet.</p>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {files.map((f) => (
            <li
              key={f.id}
              data-testid="gallery-item"
              data-file-id={f.id}
              className="border rounded-sm p-2"
            >
              <a
                href={`/api/files/${f.id}`}
                data-testid="file-link"
                target="_blank"
                rel="noreferrer"
              >
                {f.mime.startsWith('image/') ? (
                  <img
                    src={`/api/files/${f.id}`}
                    alt={f.filename}
                    className="w-full h-32 object-cover mb-2 rounded-sm"
                  />
                ) : null}
              </a>
              <div data-testid="file-name" className="text-sm truncate">
                {f.filename}
              </div>
              <div className="text-xs text-gray-500">
                {formatSize(f.size)} · {f.mime}
              </div>
              <button
                type="button"
                data-testid="delete-button"
                onClick={() => handleDelete(f.id)}
                className="mt-2 text-sm text-red-600 underline"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
