import { useQuery } from '@tanstack/react-query'
import { fetchProducts } from './api'

function Products() {
  const { data, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  })

  if (isLoading) {
    return <p>Loading...</p>
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

export default Products
