export interface Product {
  id: number
  name: string
  description: string
  price: number
  image: string
  category: string
}

export interface CartItem {
  id: number
  quantity: number
}

export interface SearchParams {
  cart?: string // JSON-serialized CartItem[]
  category?: string
  search?: string
}
