import React from 'react'
import { Link } from 'react-router-dom'
import { useQuery, getPosts } from 'wasp/client/operations'
import waspLogo from './waspLogo.png'
import './Main.css'

export const MainPage = () => {
  const { data: posts, isLoading, error } = useQuery(getPosts)

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '40px' }}>
        <img src={waspLogo} alt="wasp" style={{ maxHeight: '60px' }} />
        <h1 style={{ margin: 0, fontSize: '2.5rem' }}>Threaded Comments in Wasp</h1>
      </div>

      <div style={{ backgroundColor: '#f9f9f9', padding: '20px', borderRadius: '8px', marginBottom: '40px', border: '1px solid #eee' }}>
        <h2 style={{ marginTop: 0, fontSize: '1.5rem', color: '#333' }}>Available Discussion Posts</h2>
        
        {isLoading && <p>Loading posts...</p>}
        {error && <p style={{ color: 'red' }}>Error loading posts: {error.message}</p>}
        
        {posts && posts.length > 0 ? (
          <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
            {posts.map((post) => (
              <li key={post.id} style={{ padding: '15px 0', borderBottom: '1px solid #eee' }}>
                <Link 
                  to={`/post/${post.id}`} 
                  style={{ 
                    fontSize: '1.2rem', 
                    color: '#0066cc', 
                    textDecoration: 'none', 
                    fontWeight: 'bold' 
                  }}
                  onMouseOver={(e) => e.target.style.textDecoration = 'underline'}
                  onMouseOut={(e) => e.target.style.textDecoration = 'none'}
                >
                  {post.title}
                </Link>
                <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '4px' }}>
                  Post ID: {post.id} &bull; Click to view comments and reply
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ color: '#666', fontStyle: 'italic' }}>No posts found. Please run the seed script to create the initial post.</p>
        )}
      </div>

      <div style={{ fontSize: '0.9rem', color: '#777', borderTop: '1px solid #eee', paddingTop: '20px' }}>
        <p><strong>Instructions:</strong></p>
        <ol style={{ paddingLeft: '20px', lineHeight: '1.5' }}>
          <li>Apply database migrations: <code>wasp db migrate-dev</code></li>
          <li>Seed the database: <code>wasp db seed devSeed</code></li>
          <li>Start the app: <code>wasp start</code></li>
        </ol>
      </div>
    </div>
  )
}
