export interface Product {
  id: string
  name: string
  price: number
}

const products: Product[] = [
  { id: '1', name: 'Laptop', price: 999.99 },
  { id: '2', name: 'Smartphone', price: 599.99 },
  { id: '3', name: 'Headphones', price: 149.99 },
  { id: '4', name: 'Keyboard', price: 89.99 },
]

export const fetchProducts = async (): Promise<Product[]> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500))
  return products
}
