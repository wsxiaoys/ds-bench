import { useQuery } from '@tanstack/react-query'
import { fetchProducts } from './api'

function App() {
  const { data: products, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  })

  if (isLoading) {
    return <p>Loading...</p>
  }

  return (
    <ul>
      {products?.map((product) => (
        <li key={product.id}>
          {product.name} - ${product.price}
        </li>
      ))}
    </ul>
  )
}

export default App
