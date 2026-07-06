import { useQuery } from '@tanstack/react-query'
import './App.css'

type Product = {
  id: number
  name: string
  price: number
}

const fetchProducts = (): Promise<Product[]> => {
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
  const { data, isLoading } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: fetchProducts,
  })

  if (isLoading) {
    return <div>Loading...</div>
  }

  return (
    <ul>
      {data?.map((product) => (
        <li key={product.id}>
          {product.name} - ${product.price}
        </li>
      ))}
    </ul>
  )
}

export default App
