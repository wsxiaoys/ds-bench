import { Link } from '@tanstack/react-router'

export default function HomePage() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Home Page</h1>
      <p>Welcome! This is the public home page.</p>
      <Link to="/dashboard">Go to Dashboard</Link>
    </div>
  )
}
