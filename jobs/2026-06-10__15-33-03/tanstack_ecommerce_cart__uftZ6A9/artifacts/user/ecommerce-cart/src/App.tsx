import { useQuery } from "@tanstack/react-query";
import { useSearch, useNavigate } from "@tanstack/react-router";
import { fetchProducts } from "./api/products";
import { ProductList } from "./components/ProductList";
import { CartDisplay } from "./components/CartDisplay";
import { Header } from "./components/Header";
import "./App.css";

export type CartState = Record<string, number>; // { [productId]: quantity }

export function parseCart(cartStr: string): CartState {
  if (!cartStr) return {};
  try {
    const parsed = JSON.parse(decodeURIComponent(cartStr));
    if (typeof parsed === "object" && parsed !== null) {
      return parsed;
    }
    return {};
  } catch {
    try {
      const parsed = JSON.parse(cartStr);
      if (typeof parsed === "object" && parsed !== null) {
        return parsed;
      }
      return {};
    } catch {
      return {};
    }
  }
}

export function serializeCart(cart: CartState): string {
  return JSON.stringify(cart);
}

export default function App() {
  const search = useSearch({ strict: false }) as { cart: string };
  const navigate = useNavigate();

  const cart = parseCart(search.cart);

  const { data: products, isLoading, error } = useQuery({
    queryKey: ["products"],
    queryFn: fetchProducts,
  });

  const updateCart = (newCart: CartState) => {
    navigate({
      search: (prev: any) => ({ ...prev, cart: serializeCart(newCart) }),
      replace: false,
    } as any);
  };

  const addToCart = (productId: number) => {
    const key = String(productId);
    const newCart = { ...cart, [key]: (cart[key] || 0) + 1 };
    updateCart(newCart);
  };

  const removeFromCart = (productId: number) => {
    const key = String(productId);
    const newCart = { ...cart };
    delete newCart[key];
    updateCart(newCart);
  };

  const updateQuantity = (productId: number, quantity: number) => {
    const key = String(productId);
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    const newCart = { ...cart, [key]: quantity };
    updateCart(newCart);
  };

  if (isLoading) {
    return <div className="loading">Loading products...</div>;
  }

  if (error) {
    return <div className="error">Error loading products: {(error as Error).message}</div>;
  }

  const cartItemCount = Object.values(cart).reduce((sum, qty) => sum + qty, 0);

  return (
    <div className="app">
      <Header cartItemCount={cartItemCount} />
      <main className="main-content">
        <ProductList
          products={products || []}
          cart={cart}
          onAddToCart={addToCart}
        />
        <CartDisplay
          products={products || []}
          cart={cart}
          onUpdateQuantity={updateQuantity}
          onRemoveFromCart={removeFromCart}
        />
      </main>
    </div>
  );
}