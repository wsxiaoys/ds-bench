export interface Product {
  id: number;
  name: string;
  price: number;
  description: string;
  category: string;
  image: string;
}

export const MOCK_PRODUCTS: Product[] = [
  {
    id: 1,
    name: "Premium Wireless Headphones",
    price: 199.99,
    description: "High-fidelity sound with active noise-canceling technology.",
    category: "Electronics",
    image: "🎧",
  },
  {
    id: 2,
    name: "Minimalist Leather Wallet",
    price: 49.99,
    description: "Sleek and durable, designed to hold up to 8 cards and cash.",
    category: "Accessories",
    image: "💼",
  },
  {
    id: 3,
    name: "Smart Fitness Watch",
    price: 149.99,
    description: "Track your workouts, heart rate, and sleep with multi-day battery.",
    category: "Electronics",
    image: "⌚",
  },
  {
    id: 4,
    name: "Ergonomic Mechanical Keyboard",
    price: 129.99,
    description: "Hot-swappable keys with customizable RGB backlighting.",
    category: "Electronics",
    image: "⌨️",
  },
  {
    id: 5,
    name: "Double-Walled Travel Mug",
    price: 24.99,
    description: "Keeps your drinks hot for 12 hours or cold for 24 hours.",
    category: "Kitchen",
    image: "☕",
  },
  {
    id: 6,
    name: "Organic Cotton Hoodie",
    price: 69.99,
    description: "Super soft, sustainably sourced, and perfectly relaxed fit.",
    category: "Apparel",
    image: "🧥",
  },
];

export const fetchProducts = async (): Promise<Product[]> => {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 500));
  return MOCK_PRODUCTS;
};
