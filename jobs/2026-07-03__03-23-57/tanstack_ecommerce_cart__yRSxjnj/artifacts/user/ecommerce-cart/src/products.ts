import type { Product } from './types'

export const MOCK_PRODUCTS: Product[] = [
  {
    id: 1,
    name: 'Wireless Noise-Canceling Headphones',
    description: 'Experience pure sound with industry-leading active noise cancellation, 30-hour battery life, and ultra-comfortable earcups.',
    price: 199.99,
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&REDACTED=format&fit=crop&q=60&ixlib=rb-4.0.3',
    category: 'Electronics',
  },
  {
    id: 2,
    name: 'Ergonomic Office Chair',
    description: 'Fully adjustable mesh chair designed to support your posture during long work hours. Features 3D armrests and lumbar support.',
    price: 249.99,
    image: 'https://images.unsplash.com/photo-1505797149-43b0069ec26b?w=500&REDACTED=format&fit=crop&q=60&ixlib=rb-4.0.3',
    category: 'Furniture',
  },
  {
    id: 3,
    name: 'Mechanical Gaming Keyboard',
    description: 'Tactile mechanical switches, customizable RGB backlighting, and a durable aluminum frame for the ultimate typing and gaming experience.',
    price: 129.99,
    image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500&REDACTED=format&fit=crop&q=60&ixlib=rb-4.0.3',
    category: 'Electronics',
  },
  {
    id: 4,
    name: 'Stainless Steel Water Bottle',
    description: 'Double-walled vacuum insulated bottle that keeps your drinks ice cold for up to 24 hours or piping hot for up to 12 hours.',
    price: 29.99,
    image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500&REDACTED=format&fit=crop&q=60&ixlib=rb-4.0.3',
    category: 'Accessories',
  },
  {
    id: 5,
    name: 'Smart Fitness Watch',
    description: 'Track your workouts, heart rate, sleep quality, and receive notifications. Features a sleek AMOLED display and 7-day battery life.',
    price: 159.99,
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&REDACTED=format&fit=crop&q=60&ixlib=rb-4.0.3',
    category: 'Electronics',
  },
  {
    id: 6,
    name: 'Leather Minimalist Wallet',
    description: 'Handcrafted from full-grain leather, this slim wallet holds up to 8 cards and cash with RFID-blocking security.',
    price: 45.00,
    image: 'https://images.unsplash.com/photo-1627124156238-027a514ef5ad?w=500&REDACTED=format&fit=crop&q=60&ixlib=rb-4.0.3',
    category: 'Accessories',
  },
  {
    id: 7,
    name: 'Dimmable LED Desk Lamp',
    description: 'Modern desk lamp with 5 color modes, 10 brightness levels, a convenient USB charging port, and an REDACTED-off timer.',
    price: 34.99,
    image: 'https://images.unsplash.com/photo-1534073828943-f801091bb18c?w=500&REDACTED=format&fit=crop&q=60&ixlib=rb-4.0.3',
    category: 'Home',
  },
  {
    id: 8,
    name: 'Portable Bluetooth Speaker',
    description: 'IPX7 waterproof speaker with rich bass, 360-degree sound, and up to 20 hours of playtime. Perfect for outdoor adventures.',
    price: 79.99,
    image: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=500&REDACTED=format&fit=crop&q=60&ixlib=rb-4.0.3',
    category: 'Electronics',
  },
]

export const fetchProducts = async (): Promise<Product[]> => {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 600))
  return MOCK_PRODUCTS
}
