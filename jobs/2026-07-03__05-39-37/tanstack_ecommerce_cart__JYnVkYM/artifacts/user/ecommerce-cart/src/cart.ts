import type { Product } from './products'

// The cart is stored entirely in the URL as a single `cart` search param.
// The format is a compact, comma-separated list of `<id>x<qty>` pairs, e.g.
//
//     ?cart=2x1,5x3
//
// This keeps URLs readable while being easy to parse/serialize. The router's
// `validateSearch` (see router.ts) parses this string into a structured value
// and serializes it back when navigating.

export type CartItems = Record<number, number> // { [productId]: quantity }

/** Parse a `cart` URL param string like "2x1,5x3" into a CartItems map. */
export function parseCartParam(raw: unknown): CartItems {
  const cart: CartItems = {}
  if (typeof raw !== 'string' || raw.length === 0) return cart

  for (const part of raw.split(',')) {
    const [idStr, qtyStr] = part.split('x')
    const id = Number(idStr)
    const qty = Number(qtyStr)
    if (Number.isInteger(id) && id > 0 && Number.isInteger(qty) && qty > 0) {
      cart[id] = qty
    }
  }
  return cart
}

/** Serialize a CartItems map into a `cart` URL param string. */
export function serializeCartParam(cart: CartItems): string {
  return Object.entries(cart)
    .map(([id, qty]) => `${id}x${qty}`)
    .join(',')
}

export type CartLine = {
  product: Product
  quantity: number
  subtotal: number
}

/** Combine a cart map with the product catalog to produce displayable lines. */
export function buildCartLines(cart: CartItems, products: Product[]): CartLine[] {
  const lines: CartLine[] = []
  for (const product of products) {
    const quantity = cart[product.id]
    if (quantity) {
      lines.push({
        product,
        quantity,
        subtotal: product.price * quantity,
      })
    }
  }
  return lines
}

export function cartTotal(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.subtotal, 0)
}

export function cartCount(cart: CartItems): number {
  return Object.values(cart).reduce((sum, q) => sum + q, 0)
}