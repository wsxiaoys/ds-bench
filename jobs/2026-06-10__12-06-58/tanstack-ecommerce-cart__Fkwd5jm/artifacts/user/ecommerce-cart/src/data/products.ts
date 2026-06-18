export interface Product {
  id: number
  name: string
  description: string
  price: number
  image: string
  category: string
  rating: number
  stock: number
}

export const PRODUCTS: Product[] = [
  {
    id: 1,
    name: 'Wireless Noise-Cancelling Headphones',
    description: 'Premium sound quality with 30-hour battery life and active noise cancellation.',
    price: 299.99,
    image: '🎧',
    category: 'Electronics',
    rating: 4.8,
    stock: 15,
  },
  {
    id: 2,
    name: 'Ergonomic Mechanical Keyboard',
    description: 'Tactile switches with RGB backlighting, built for long coding sessions.',
    price: 149.99,
    image: '⌨️',
    category: 'Electronics',
    rating: 4.6,
    stock: 23,
  },
  {
    id: 3,
    name: '4K Ultra-Wide Monitor',
    description: '34-inch curved display with HDR support and 144Hz refresh rate.',
    price: 799.99,
    image: '🖥️',
    category: 'Electronics',
    rating: 4.9,
    stock: 8,
  },
  {
    id: 4,
    name: 'Minimalist Leather Backpack',
    description: 'Handcrafted full-grain leather with padded laptop compartment (fits up to 15").',
    price: 189.99,
    image: '🎒',
    category: 'Accessories',
    rating: 4.7,
    stock: 30,
  },
  {
    id: 5,
    name: 'Smart Fitness Watch',
    description: 'Heart rate monitor, GPS, sleep tracking, and 7-day battery life.',
    price: 249.99,
    image: '⌚',
    category: 'Wearables',
    rating: 4.5,
    stock: 42,
  },
  {
    id: 6,
    name: 'Portable Bluetooth Speaker',
    description: 'Waterproof IPX7 rated, 360° sound, 24-hour playtime.',
    price: 89.99,
    image: '🔊',
    category: 'Electronics',
    rating: 4.4,
    stock: 55,
  },
  {
    id: 7,
    name: 'Standing Desk Converter',
    description: 'Height-adjustable converter with dual monitor support and cable management.',
    price: 229.99,
    image: '🖥️',
    category: 'Furniture',
    rating: 4.3,
    stock: 12,
  },
  {
    id: 8,
    name: 'USB-C Hub (10-in-1)',
    description: 'Supports 4K HDMI, 100W PD charging, SD card, and multiple USB ports.',
    price: 59.99,
    image: '🔌',
    category: 'Electronics',
    rating: 4.6,
    stock: 78,
  },
  {
    id: 9,
    name: 'Desk Lamp with Wireless Charging',
    description: 'Adjustable color temperature and brightness, with 15W Qi charging pad.',
    price: 79.99,
    image: '💡',
    category: 'Accessories',
    rating: 4.5,
    stock: 34,
  },
  {
    id: 10,
    name: 'Noise-Isolating Earbuds',
    description: 'True wireless earbuds with 8hr battery, transparency mode, and ANC.',
    price: 179.99,
    image: '🎵',
    category: 'Electronics',
    rating: 4.7,
    stock: 20,
  },
  {
    id: 11,
    name: 'Premium Coffee Grinder',
    description: 'Conical burr grinder with 31 grind settings for espresso to French press.',
    price: 119.99,
    image: '☕',
    category: 'Kitchen',
    rating: 4.8,
    stock: 17,
  },
  {
    id: 12,
    name: 'Thermal Water Bottle',
    description: 'Double-walled stainless steel, keeps drinks cold 24hrs or hot 12hrs.',
    price: 34.99,
    image: '🧴',
    category: 'Accessories',
    rating: 4.6,
    stock: 100,
  },
]

// Simulated async fetch with a small delay to showcase TanStack Query
export async function fetchProducts(): Promise<Product[]> {
  await new Promise((resolve) => setTimeout(resolve, 600))
  return PRODUCTS
}

export async function fetchProduct(id: number): Promise<Product | undefined> {
  await new Promise((resolve) => setTimeout(resolve, 300))
  return PRODUCTS.find((p) => p.id === id)
}
