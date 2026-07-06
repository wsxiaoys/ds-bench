import type { Product } from '../types';

// Mock product data
const PRODUCTS: Product[] = [
  {
    id: 1,
    name: 'Wireless Headphones',
    price: 79.99,
    description: 'Premium noise-cancelling wireless headphones with 30-hour battery life.',
    image: 'https://picsum.photos/seed/headphones/300/200',
    category: 'Electronics',
  },
  {
    id: 2,
    name: 'Mechanical Keyboard',
    price: 129.99,
    description: 'RGB mechanical keyboard with Cherry MX Red switches and hot-swappable keys.',
    image: 'https://picsum.photos/seed/keyboard/300/200',
    category: 'Electronics',
  },
  {
    id: 3,
    name: 'Coffee Mug',
    price: 14.99,
    description: 'Ceramic coffee mug, 12oz capacity, microwave and dishwasher safe.',
    image: 'https://picsum.photos/seed/mug/300/200',
    category: 'Home',
  },
  {
    id: 4,
    name: 'Standing Desk',
    price: 449.99,
    description: 'Electric height-adjustable standing desk with memory presets.',
    image: 'https://picsum.photos/seed/desk/300/200',
    category: 'Furniture',
  },
  {
    id: 5,
    name: 'USB-C Hub',
    price: 39.99,
    description: '7-in-1 USB-C hub with HDMI, USB 3.0, SD card reader, and PD charging.',
    image: 'https://picsum.photos/seed/usbhub/300/200',
    category: 'Electronics',
  },
  {
    id: 6,
    name: 'Leather Backpack',
    price: 89.99,
    description: 'Genuine leather backpack with padded laptop compartment for up to 15".',
    image: 'https://picsum.photos/seed/backpack/300/200',
    category: 'Accessories',
  },
  {
    id: 7,
    name: 'Yoga Mat',
    price: 29.99,
    description: 'Non-slip eco-friendly yoga mat with carrying strap, 6mm thick.',
    image: 'https://picsum.photos/seed/yogamat/300/200',
    category: 'Sports',
  },
  {
    id: 8,
    name: 'Desk Lamp',
    price: 49.99,
    description: 'LED desk lamp with adjustable brightness and color temperature.',
    image: 'https://picsum.photos/seed/desklamp/300/200',
    category: 'Home',
  },
];

// Mock API function - simulates fetching products from a server
export async function fetchProducts(): Promise<Product[]> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 500));
  return PRODUCTS;
}

export async function fetchProductById(id: number): Promise<Product | undefined> {
  await new Promise((resolve) => setTimeout(resolve, 100));
  return PRODUCTS.find((p) => p.id === id);
}