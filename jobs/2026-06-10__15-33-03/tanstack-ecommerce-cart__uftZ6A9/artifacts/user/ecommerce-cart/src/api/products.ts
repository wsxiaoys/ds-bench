export interface Product {
  id: number;
  name: string;
  price: number;
  description: string;
  image: string;
}

export const products: Product[] = [
  {
    id: 1,
    name: "Wireless Headphones",
    price: 79.99,
    description: "Premium noise-cancelling wireless headphones with 30-hour battery life.",
    image: "🎧",
  },
  {
    id: 2,
    name: "Mechanical Keyboard",
    price: 129.99,
    description: "RGB mechanical keyboard with cherry MX switches.",
    image: "⌨️",
  },
  {
    id: 3,
    name: "Gaming Mouse",
    price: 49.99,
    description: "Ergonomic gaming mouse with 16,000 DPI sensor.",
    image: "🖱️",
  },
  {
    id: 4,
    name: "USB-C Hub",
    price: 39.99,
    description: "7-in-1 USB-C hub with HDMI, USB 3.0, and SD card reader.",
    image: "🔌",
  },
  {
    id: 5,
    name: "Monitor Stand",
    price: 59.99,
    description: "Adjustable monitor stand with cable management.",
    image: "🖥️",
  },
  {
    id: 6,
    name: "Webcam HD",
    price: 69.99,
    description: "1080p HD webcam with built-in microphone and auto-focus.",
    image: "📷",
  },
  {
    id: 7,
    name: "Desk Lamp",
    price: 34.99,
    description: "LED desk lamp with adjustable brightness and color temperature.",
    image: "💡",
  },
  {
    id: 8,
    name: "Laptop Sleeve",
    price: 24.99,
    description: "Shock-absorbing laptop sleeve for 13-15 inch laptops.",
    image: "💻",
  },
];

// Simulate an async API call
export async function fetchProducts(): Promise<Product[]> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(products), 300);
  });
}