import { useState } from 'react'
import { Link } from 'react-router'
import { useQuery, getDocuments, createDocument } from 'wasp/client/operations'
import { logout } from 'wasp/client/auth'

export function MainPage() {
  const { data: documents, isLoading, error } = useQuery(getDocuments)
  const [newTitle, setNewTitle] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return

    setIsSubmitting(true)
    try {
      await createDocument({ title: newTitle })
      setNewTitle('')
    } catch (err: any) {
      alert(err.message || 'Failed to create document')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', borderBottom: '1px solid #eee', paddingBottom: '20px' }}>
        <h1 style={{ margin: 0 }}>Collaborative Document Editor</h1>
        <button 
          onClick={logout}
          style={{ padding: '8px 16px', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Logout
        </button>
      </header>

      <section style={{ marginBottom: '40px' }}>
        <h2>Create a New Document</h2>
        <form onSubmit={handleCreateDocument} style={{ display: 'flex', gap: '10px' }}>
          <input
            id="document-title-input"
            type="text"
            placeholder="Document Title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            required
            style={{ flex: 1, padding: '10px', fontSize: '16px', border: '1px solid #ccc', borderRadius: '4px' }}
          />
          <button
            id="create-document-btn"
            type="submit"
            disabled={isSubmitting}
            style={{ padding: '10px 20px', fontSize: '16px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            {isSubmitting ? 'Creating...' : 'Create Document'}
          </button>
        </form>
      </section>

      <section>
        <h2>Your Documents</h2>
        {isLoading && <p>Loading documents...</p>}
        {error && <p style={{ color: 'red' }}>Error loading documents: {error.message || 'Unknown error'}</p>}
        {documents && documents.length === 0 && <p>No documents found. Create one above!</p>}
        {documents && documents.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {documents.map((doc: any) => (
              <li 
                key={doc.id}
                style={{ 
                  padding: '15px', 
                  border: '1px solid #ddd', 
                  borderRadius: '4px', 
                  marginBottom: '10px', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}
              >
                <div>
                  <h3 style={{ margin: '0 0 5px 0' }}>
                    <Link to={`/document/${doc.id}`} style={{ color: '#2196F3', textDecoration: 'none', fontWeight: 'bold' }}>
                      {doc.title}
                    </Link>
                  </h3>
                  <small style={{ color: '#666' }}>
                    Last updated: {new Date(doc.updatedAt).toLocaleString()}
                  </small>
                </div>
                <Link 
                  to={`/document/${doc.id}`}
                  style={{ 
                    padding: '8px 16px', 
                    background: '#2196F3', 
                    color: 'white', 
                    textDecoration: 'none', 
                    borderRadius: '4px', 
                    fontSize: '14px' 
                  }}
                >
                  Open Editor
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
