export interface Product {
  id: string
  name: string
  price: number
  description: string
  image: string
}

export const products: Product[] = [
  {
    id: 'prod-1',
    name: 'Wireless Headphones',
    price: 79.99,
    description: 'Premium noise-cancelling wireless headphones with 30-hour battery life.',
    image: '🎧',
  },
  {
    id: 'prod-2',
    name: 'Mechanical Keyboard',
    price: 129.99,
    description: 'RGB mechanical keyboard with Cherry MX switches and aluminum frame.',
    image: '⌨️',
  },
  {
    id: 'prod-3',
    name: 'USB-C Hub',
    price: 49.99,
    description: '7-in-1 USB-C hub with HDMI, SD card reader, and 100W power delivery.',
    image: '🔌',
  },
  {
    id: 'prod-4',
    name: 'Laptop Stand',
    price: 39.99,
    description: 'Adjustable aluminum laptop stand with ergonomic design.',
    image: '💻',
  },
  {
    id: 'prod-5',
    name: 'Webcam 4K',
    price: 99.99,
    description: '4K webcam with auto-focus, built-in microphone, and privacy shutter.',
    image: '📷',
  },
  {
    id: 'prod-6',
    name: 'Desk Mat',
    price: 29.99,
    description: 'Large felt desk mat, water-resistant, 90x40cm.',
    image: '🖱️',
  },
  {
    id: 'prod-7',
    name: 'Monitor Light Bar',
    price: 59.99,
    description: 'LED monitor light bar with adjustable color temperature and brightness.',
    image: '💡',
  },
  {
    id: 'prod-8',
    name: 'Cable Management Kit',
    price: 19.99,
    description: 'Complete cable management kit with clips, sleeves, and ties.',
    image: '🔗',
  },
]
