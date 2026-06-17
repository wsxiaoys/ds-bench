import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: IndexPage,
})

function IndexPage() {
  return (
    <div style={{ maxWidth: 600, margin: '40px auto', padding: '0 20px', textAlign: 'center' }}>
      <h1>TanStack Router Search Demo</h1>
      <p>
        <Link
          to="/search"
          search={{ q: '', category: '', minPrice: 0, maxPrice: 0 }}
          style={{ color: '#1a73e8', fontSize: 18 }}
        >
          Go to Search Page →
        </Link>
      </p>
    </div>
  )
}
