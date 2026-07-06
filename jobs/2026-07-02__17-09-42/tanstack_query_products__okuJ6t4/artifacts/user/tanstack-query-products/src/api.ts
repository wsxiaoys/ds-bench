export type Product = {
  id: number
  name: string
  price: number
}

const products: Product[] = [
  { id: 1, name: 'Laptop', price: 999 },
  { id: 2, name: 'Phone', price: 599 },
]

/**
 * Mock fetch function that simulates a network request for products.
 * Returns a promise that resolves after a short delay (500ms).
 */
export function fetchProducts(): Promise<Product[]> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(products), 500)
  })
}
