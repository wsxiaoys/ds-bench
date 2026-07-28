import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useState, useEffect, useRef } from 'react'
import { getDb } from '../lib/db'

interface FileMetadata {
  id: number
  filename: string
  size: number
  mime: string
  uploadedAt: string
}

// Server function to fetch files from SQLite DB
const getFilesServer = createServerFn({ method: 'GET' })
  .handler(async () => {
    try {
      const db = await getDb()
      const files = await db.all(
        'SELECT id, filename, size, mime, uploadedAt FROM files ORDER BY id DESC'
      )
      return files as FileMetadata[]
    } catch (err) {
      console.error('Error fetching files in server function:', err)
      return [] as FileMetadata[]
    }
  })

export const Route = createFileRoute('/')({
  loader: async () => {
    const initialFiles = await getFilesServer()
    return { initialFiles }
  },
  component: GalleryPage
})

function GalleryPage() {
  const { initialFiles } = Route.useLoaderData()
  const [files, setFiles] = useState<FileMetadata[]>(initialFiles)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch files from /api/files (to refresh the list)
  const fetchFiles = async () => {
    try {
      const response = await fetch('/api/files')
      if (response.ok) {
        const data = await response.json()
        setFiles(data)
      } else {
        console.error('Failed to fetch files')
      }
    } catch (err) {
      console.error('Error fetching files:', err)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0])
      setError(null) // Clear error on new selection
    } else {
      setSelectedFile(null)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file to upload.')
      return
    }

    setIsUploading(true)
    setError(null)

    const formData = new FormData()
    formData.append('file', selectedFile)

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (response.ok) {
        // Clear selection and refresh list
        setSelectedFile(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        await fetchFiles()
      } else {
        setError(data.error || 'Upload failed')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during upload.')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(`/api/files/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        // Refresh list
        await fetchFiles()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to delete file')
      }
    } catch (err) {
      console.error('Error deleting file:', err)
    }
  }

  return (
    <main className="page-wrap px-4 pb-8 pt-14 max-w-5xl mx-auto">
      <section className="island-shell rise-in relative overflow-hidden rounded-[2rem] px-6 py-10 sm:px-10 sm:py-14 mb-8">
        <h1 className="display-title mb-5 text-3xl font-bold tracking-tight text-[var(--sea-ink)] sm:text-5xl">
          Image Upload Gallery
        </h1>
        <p className="mb-8 max-w-2xl text-base text-[var(--sea-ink-soft)] sm:text-lg">
          Upload and manage your images locally. Supported formats: PNG, JPEG, GIF, WebP (Max 2 MiB).
        </p>

        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <input
            type="file"
            data-testid="file-input"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[rgba(79,184,178,0.14)] file:text-[var(--lagoon-deep)] hover:file:bg-[rgba(79,184,178,0.24)] text-sm text-[var(--sea-ink-soft)]"
          />
          <button
            data-testid="upload-button"
            onClick={handleUpload}
            disabled={isUploading}
            className="rounded-full bg-[var(--lagoon-deep)] hover:bg-[var(--lagoon-deep-hover,rgba(23,58,64,0.9))] text-white px-6 py-2.5 text-sm font-semibold transition disabled:opacity-50"
          >
            {isUploading ? 'Uploading...' : 'Upload File'}
          </button>
        </div>

        {error && (
          <div
            data-testid="upload-error"
            className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-medium"
          >
            {error}
          </div>
        )}
      </section>

      <section className="island-shell rounded-2xl p-6">
        <h2 className="text-xl font-bold text-[var(--sea-ink)] mb-6">Uploaded Images</h2>
        {files.length === 0 ? (
          <p className="text-sm text-[var(--sea-ink-soft)] italic">No files uploaded yet.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {files.map((file) => (
              <article
                key={file.id}
                data-testid="gallery-item"
                data-file-id={file.id}
                className="border border-[rgba(23,58,64,0.1)] rounded-xl overflow-hidden bg-white shadow-sm flex flex-col"
              >
                <div className="h-48 bg-gray-50 flex items-center justify-center overflow-hidden border-b border-gray-100 relative group">
                  <img
                    src={`/api/files/${file.id}`}
                    alt={file.filename}
                    className="max-h-full max-w-full object-contain transition group-hover:scale-105 duration-300"
                  />
                </div>
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div className="mb-4">
                    <p
                      data-testid="file-name"
                      className="font-semibold text-sm text-[var(--sea-ink)] truncate"
                      title={file.filename}
                    >
                      {file.filename}
                    </p>
                    <p className="text-xs text-[var(--sea-ink-soft)] mt-1">
                      {(file.size / 1024).toFixed(1)} KiB • {file.mime}
                    </p>
                  </div>
                  <div className="flex justify-between items-center gap-2 pt-2 border-t border-gray-50">
                    <a
                      data-testid="file-link"
                      href={`/api/files/${file.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-[var(--lagoon-deep)] hover:underline"
                    >
                      View Raw
                    </a>
                    <button
                      data-testid="delete-button"
                      onClick={() => handleDelete(file.id)}
                      className="text-xs font-semibold text-red-600 hover:text-red-800 transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
