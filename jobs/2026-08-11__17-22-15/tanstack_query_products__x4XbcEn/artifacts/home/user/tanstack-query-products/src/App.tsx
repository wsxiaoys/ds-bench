import { useQuery } from '@tanstack/react-query'

interface Product {
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
  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: fetchProducts,
  })

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto', textAlign: 'left' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '1.5rem' }}>Products</h1>
      <ul style={{ listStyleType: 'disc', paddingLeft: '1.5rem' }}>
        {products?.map((product) => (
          <li key={product.id} style={{ margin: '0.5rem 0', fontSize: '1.2rem' }}>
            {product.name} - ${product.price}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default App
