export interface Product {
  id: number;
  name: string;
  price: number;
}

const products: Product[] = [
  { id: 1, name: "Laptop", price: 999 },
  { id: 2, name: "Phone", price: 599 },
];

export function fetchProducts(): Promise<Product[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(products);
    }, 500);
  });
}
