import React from 'react'
import { Link } from 'react-router-dom'
import { useQuery, getPosts } from 'wasp/client/operations'
import './Main.css'

export const MainPage = () => {
  const { data: posts, isLoading, error } = useQuery(getPosts)

  if (isLoading) return <div className="container"><main>Loading posts...</main></div>
  if (error) return <div className="container"><main>Error: {error.message || error}</main></div>

  return (
    <div className="container" style={{ fontFamily: 'sans-serif' }}>
      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
        <h2 className="welcome-title" style={{ textAlign: 'center', color: '#111827' }}>
          Wasp Threaded Comments
        </h2>
        <h3 className="welcome-subtitle" style={{ textAlign: 'center', color: '#4b5563', fontWeight: 'normal' }}>
          Select a post below to view its threaded comment system.
        </h3>

        <div className="posts-list" style={{ marginTop: '30px' }}>
          {posts && posts.length > 0 ? (
            posts.map(post => (
              <div key={post.id} className="post-card" style={{ padding: '20px', border: '1px solid #e5e7eb', borderRadius: '8px', marginBottom: '15px', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h4 style={{ margin: '0 0 15px 0', fontSize: '1.25em', color: '#111827' }}>{post.title}</h4>
                <Link 
                  to={`/post/${post.id}`} 
                  className="button button-filled" 
                  style={{ textDecoration: 'none', display: 'inline-block', padding: '10px 20px', background: '#4f46e5', color: '#fff', borderRadius: '4px', fontWeight: 'bold' }}
                >
                  View Discussion &rarr;
                </Link>
              </div>
            ))
          ) : (
            <p style={{ textAlign: 'center', color: '#6b7280' }}>No posts found. Please run the database seed to create initial posts and users.</p>
          )}
        </div>
      </main>
    </div>
  )
}
