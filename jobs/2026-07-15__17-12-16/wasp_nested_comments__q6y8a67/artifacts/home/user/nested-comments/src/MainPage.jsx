import React from 'react'
import { Link } from 'react-router-dom'
import { useQuery, getPosts } from 'wasp/client/operations'
import waspLogo from './waspLogo.png'
import './Main.css'

export const MainPage = () => {
  const { data: posts, isLoading, error } = useQuery(getPosts)

  return (
    <div className="container" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <main>
        <div className="logo" style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <img src={waspLogo} alt="wasp" style={{ maxHeight: '100px' }} />
        </div>

        <h1 className="welcome-title" style={{ textAlign: 'center', fontSize: '2em', marginBottom: '10px' }}>
          Wasp Threaded Comments Demo
        </h1>

        {isLoading && <p style={{ textAlign: 'center' }}>Loading posts...</p>}
        {error && <p style={{ color: 'red', textAlign: 'center' }}>Error: {error.message}</p>}

        <div style={{ marginTop: '30px' }}>
          <h3>Available Posts</h3>
          {posts && posts.length > 0 ? (
            <ul style={{ listStyleType: 'none', padding: 0 }}>
              {posts.map(post => (
                <li key={post.id} style={{ padding: '15px', border: '1px solid #eee', borderRadius: '5px', marginBottom: '10px', background: '#fcfcfc' }}>
                  <Link to={`/post/${post.id}`} style={{ fontSize: '1.2em', fontWeight: 'bold', textDecoration: 'none', color: '#4f46e5' }}>
                    {post.title}
                  </Link>
                  <div style={{ color: '#666', fontSize: '0.9em', marginTop: '5px' }}>
                    Post ID: {post.id}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ fontStyle: 'italic', color: '#666' }}>No posts found. Please run the seed function!</p>
          )}
        </div>
      </main>
    </div>
  )
}
