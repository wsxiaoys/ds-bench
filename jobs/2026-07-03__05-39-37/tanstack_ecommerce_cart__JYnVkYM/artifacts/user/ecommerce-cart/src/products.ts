export type Product = {
  id: number
  name: string
  price: number
  category: string
  image: string
  description: string
}

// A small catalog of mock products. In a real app these would come from a
// backend API, but for this demo we use an in-memory list wrapped in a promise
// so TanStack Query's `useQuery` behaves exactly like it would with a network
// request (loading / success / error states).
export const MOCK_PRODUCTS: Product[] = [
  {
    id: 1,
    name: 'Wireless Headphones',
    price: 129.99,
    category: 'Audio',
    image: '🎧',
    description: 'Noise-cancelling over-ear headphones with 30h battery life.',
  },
  {
    id: 2,
    name: 'Mechanical Keyboard',
    price: 89.5,
    category: 'Peripherals',
    image: '⌨️',
    description: 'Hot-swappable switches with RGB backlighting.',
  },
  {
    id: 3,
    name: '4K Webcam',
    price: 159.0,
    category: 'Video',
    image: '📷',
    description: 'High-definition webcam with REDACTED-focus and low-light correction.',
  },
  {
    id: 4,
    name: 'USB-C Hub',
    price: 39.99,
    category: 'Accessories',
    image: '🔌',
    description: '7-in-1 hub with HDMI, SD card reader and 100W PD pass-through.',
  },
  {
    id: 5,
    name: 'Standing Desk Mat',
    price: 54.95,
    category: 'Office',
    image: '🟫',
    description: 'Ergonomic anti-fatigue mat for standing desks.',
  },
  {
    id: 6,
    name: 'Smart LED Lamp',
    price: 44.99,
    category: 'Lighting',
    image: '💡',
    description: 'App-controlled LED lamp with 16M colors.',
  },
  {
    id: 7,
    name: 'Bluetooth Speaker',
    price: 74.99,
    category: 'Audio',
    image: '🔊',
    description: 'Portable waterproof speaker with 12h playback.',
  },
  {
    id: 8,
    name: 'Laptop Stand',
    price: 34.99,
    category: 'Office',
    image: '💻',
    description: 'Aluminum adjustable laptop stand for better posture.',
  },
]

// Simulate a network request with a small delay.
export function fetchProducts(): Promise<Product[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(MOCK_PRODUCTS)
    }, 300)
  })
}