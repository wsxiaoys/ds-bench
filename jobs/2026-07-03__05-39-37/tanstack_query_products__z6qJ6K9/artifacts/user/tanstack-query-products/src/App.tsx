import { useQuery } from '@tanstack/react-query'
import { fetchProducts } from './products'
import './App.css'

function App() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  })

  if (isLoading) {
    return <p>Loading...</p>
  }

  if (error) {
    return <p>Error loading products.</p>
  }

  return (
    <div className="app">
      <h1>Products</h1>
      <ul>
        {data?.map((product) => (
          <li key={product.id}>
            {product.name} - ${product.price}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default App