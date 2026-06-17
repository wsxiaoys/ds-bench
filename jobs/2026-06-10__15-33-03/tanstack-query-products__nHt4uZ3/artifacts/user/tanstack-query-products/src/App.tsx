import { useQuery } from '@tanstack/react-query'

interface Product {
  id: number
  name: string
  price: number
}

function fetchProducts(): Promise<Product[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        { id: 1, name: 'Laptop', price: 999 },
        { id: 2, name: 'Phone', price: 599 },
      ])
    }, 500)
  })
}

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