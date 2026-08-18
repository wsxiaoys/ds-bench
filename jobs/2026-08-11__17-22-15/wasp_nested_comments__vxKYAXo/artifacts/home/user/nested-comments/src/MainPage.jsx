import React from 'react'
import { Link } from 'react-router-dom'
import { useQuery, getPosts } from 'wasp/client/operations'
import waspLogo from './waspLogo.png'
import './Main.css'

export const MainPage = () => {
  const { data: posts, isLoading, error } = useQuery(getPosts)

  return (
    <div className="container" style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <main>
        <div className="logo" style={{ textAlign: 'center', marginBottom: '20px' }}>
          <img src={waspLogo} alt="wasp" style={{ height: '80px' }} />
        </div>

        <h2 className="welcome-title" style={{ textAlign: 'center', marginBottom: '10px' }}>
          Wasp Threaded Comments App
        </h2>
        <p className="welcome-subtitle" style={{ textAlign: 'center', color: '#6b7280', marginBottom: '30px' }}>
          A full-stack nested comment system built with Wasp, React, and Prisma.
        </p>

        <div style={{ backgroundColor: '#fff', padding: '25px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' }}>
          <h3 style={{ marginBottom: '15px', color: '#111827' }}>Available Posts</h3>
          {isLoading && <p>Loading posts...</p>}
          {error && <p style={{ color: '#ef4444' }}>Error: {error.message}</p>}
          {posts && posts.length > 0 ? (
            <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
              {posts.map((post) => (
                <li key={post.id} style={{ padding: '12px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <Link
                    to={`/post/${post.id}`}
                    style={{
                      fontSize: '1.1rem',
                      fontWeight: '600',
                      color: '#4f46e5',
                      textDecoration: 'none'
                    }}
                  >
                    {post.title}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            posts && <p style={{ color: '#6b7280', fontStyle: 'italic' }}>No posts found. Please run the seed command.</p>
          )}
        </div>
      </main>
    </div>
  )
}
