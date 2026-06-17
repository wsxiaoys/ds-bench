import { useQuery } from '@tanstack/react-query'

interface Product {
  id: number
  name: string
  price: number
}

const fetchProducts = (): Promise<Product[]> =>
  new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        { id: 1, name: 'Laptop', price: 999 },
        { id: 2, name: 'Phone', price: 599 },
      ])
    }, 500)
  })

function App() {
  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: fetchProducts,
  })

  return (
    <div>
      <h1>Products</h1>
      {isLoading ? (
        <p>Loading...</p>
      ) : (
        <ul>
          {products?.map((product) => (
            <li key={product.id}>
              {product.name} - ${product.price}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default App
