import { useQuery } from '@tanstack/react-query'

type Product = {
  id: number
  name: string
  price: number
}

const fetchProducts = async (): Promise<Product[]> => {
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
  const { data, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  })

  if (isLoading) {
    return <div>Loading...</div>
  }

  return (
    <div>
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
