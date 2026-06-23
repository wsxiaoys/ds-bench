import { products, type Product } from './mock-data'

// Simulate network delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function fetchProducts(): Promise<Product[]> {
  await delay(500)
  return products
}

export async function fetchProduct(id: string): Promise<Product | undefined> {
  await delay(300)
  return products.find((p) => p.id === id)
}
