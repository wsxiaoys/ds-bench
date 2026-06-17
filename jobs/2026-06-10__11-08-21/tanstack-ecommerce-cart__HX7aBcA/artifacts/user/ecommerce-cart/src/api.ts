export interface Product {
  id: number;
  name: string;
  price: number;
  description: string;
  image: string;
  category: string;
}

export const mockProducts: Product[] = [
  {
    id: 1,
    name: "Wireless Noise-Canceling Headphones",
    price: 299.99,
    description: "Premium over-ear headphones with active noise cancellation and 30-hour battery life.",
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    category: "Electronics"
  },
  {
    id: 2,
    name: "Minimalist Leather Watch",
    price: 149.50,
    description: "Classic design watch with a genuine leather strap and scratch-resistant sapphire glass.",
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    category: "Accessories"
  },
  {
    id: 3,
    name: "Ergonomic Mechanical Keyboard",
    price: 189.00,
    description: "Hot-swappable mechanical keyboard with RGB backlighting and tactile brown switches.",
    image: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    category: "Electronics"
  },
  {
    id: 4,
    name: "Double-Walled Travel Mug",
    price: 34.99,
    description: "Vacuum-insulated stainless steel tumbler that keeps drinks hot for 12 hours or cold for 24 hours.",
    image: "https://images.unsplash.com/photo-1577937927133-66ef06acdf18?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    category: "Home & Kitchen"
  },
  {
    id: 5,
    name: "Ultra-Wide Curved Gaming Monitor",
    price: 449.99,
    description: "34-inch curved monitor with a 144Hz refresh rate and 1ms response time for immersive gaming.",
    image: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    category: "Electronics"
  },
  {
    id: 6,
    name: "Water-Resistant Commuter Backpack",
    price: 79.99,
    description: "Sleek backpack with a padded laptop compartment and hidden anti-theft pocket.",
    image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    category: "Accessories"
  }
];

export const fetchProducts = async (): Promise<Product[]> => {
  // Simulate network latency
  await new Promise((resolve) => setTimeout(resolve, 600));
  return mockProducts;
};
