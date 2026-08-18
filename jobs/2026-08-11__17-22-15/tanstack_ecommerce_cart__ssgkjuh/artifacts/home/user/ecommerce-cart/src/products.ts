export interface Product {
  id: number;
  name: string;
  price: number;
  description: string;
  image: string;
  category: string;
}

const MOCK_PRODUCTS: Product[] = [
  {
    id: 1,
    name: "Wireless Noise-Canceling Headphones",
    price: 299.99,
    description: "Experience premium sound and industry-leading noise cancellation. Perfect for travel, work, and everything in between.",
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    category: "Electronics"
  },
  {
    id: 2,
    name: "Minimalist Leather Watch",
    price: 149.50,
    description: "A classic design with a modern touch. Features a genuine Italian leather strap and water-resistant casing.",
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    category: "Accessories"
  },
  {
    id: 3,
    name: "Ergonomic Mechanical Keyboard",
    price: 189.00,
    description: "Hot-swappable mechanical switches with RGB backlighting. Designed for ultimate typing comfort and productivity.",
    image: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    category: "Electronics"
  },
  {
    id: 4,
    name: "Eco-Friendly Cork Yoga Mat",
    price: 79.99,
    description: "Non-slip grip cork surface made from sustainable materials. Extra cushioning for joints during your daily practice.",
    image: "https://images.unsplash.com/photo-1592432678016-e910b452f9a2?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    category: "Fitness"
  },
  {
    id: 5,
    name: "Smart Water Bottle",
    price: 45.00,
    description: "Tracks your hydration, glows to remind you to drink, and keeps your beverages cold for up to 24 hours.",
    image: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    category: "Fitness"
  },
  {
    id: 6,
    name: "Portable Espresso Maker",
    price: 119.00,
    description: "Brew rich, authentic espresso anywhere. Hand-powered, lightweight, and perfect for camping or travel.",
    image: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    category: "Kitchen"
  }
];

export const fetchProducts = async (): Promise<Product[]> => {
  // Simulate network delay of 500ms
  await new Promise((resolve) => setTimeout(resolve, 500));
  return MOCK_PRODUCTS;
};
