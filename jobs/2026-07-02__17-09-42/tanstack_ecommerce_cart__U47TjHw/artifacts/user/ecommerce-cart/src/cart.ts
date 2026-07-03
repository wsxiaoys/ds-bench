import type { CartItem } from './types';

/**
 * Encodes the cart state to a URL-friendly string.
 * Format: id1:qty1,id2:qty2
 */
export function encodeCart(items: CartItem[]): string {
  if (!items || items.length === 0) return '';
  return items.map((item) => `${item.id}:${item.qty}`).join(',');
}

/**
 * Decodes the cart state from a URL string.
 * Returns an empty array if the string is empty or invalid.
 */
export function decodeCart(value: unknown): CartItem[] {
  if (typeof value !== 'string' || value.trim() === '') return [];
  const items: CartItem[] = [];
  const parts = value.split(',');
  for (const part of parts) {
    const [idStr, qtyStr] = part.split(':');
    const id = Number(idStr);
    const qty = Number(qtyStr);
    if (Number.isInteger(id) && id > 0 && Number.isInteger(qty) && qty > 0) {
      items.push({ id, qty });
    }
  }
  return items;
}

/**
 * Adds an item to the cart or increments its quantity.
 */
export function addToCart(items: CartItem[], productId: number, qty = 1): CartItem[] {
  const existing = items.find((item) => item.id === productId);
  if (existing) {
    return items.map((item) =>
      item.id === productId ? { ...item, qty: item.qty + qty } : item
    );
  }
  return [...items, { id: productId, qty }];
}

/**
 * Updates the quantity of an item in the cart.
 * Removes the item if quantity becomes 0 or negative.
 */
export function updateCartItemQty(items: CartItem[], productId: number, qty: number): CartItem[] {
  if (qty <= 0) {
    return items.filter((item) => item.id !== productId);
  }
  return items.map((item) =>
    item.id === productId ? { ...item, qty } : item
  );
}

/**
 * Removes an item from the cart.
 */
export function removeFromCart(items: CartItem[], productId: number): CartItem[] {
  return items.filter((item) => item.id !== productId);
}