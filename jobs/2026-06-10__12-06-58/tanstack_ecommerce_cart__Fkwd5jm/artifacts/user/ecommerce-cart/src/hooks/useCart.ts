import { useNavigate, useSearch } from '@tanstack/react-router'
import { shopRoute, type CartItem } from '../router'

export function useCart() {
  const { cart } = useSearch({ from: shopRoute.id })
  const navigate = useNavigate({ from: shopRoute.id })

  function updateCart(updater: (prev: CartItem[]) => CartItem[]) {
    navigate({
      search: (prev) => ({
        ...prev,
        cart: updater(prev.cart ?? []),
      }),
      replace: true,
    })
  }

  function addItem(productId: number) {
    updateCart((prev) => {
      const existing = prev.find((i) => i.id === productId)
      if (existing) {
        return prev.map((i) =>
          i.id === productId ? { ...i, qty: i.qty + 1 } : i
        )
      }
      return [...prev, { id: productId, qty: 1 }]
    })
  }

  function removeItem(productId: number) {
    updateCart((prev) => prev.filter((i) => i.id !== productId))
  }

  function setQuantity(productId: number, qty: number) {
    if (qty <= 0) {
      removeItem(productId)
      return
    }
    updateCart((prev) =>
      prev.map((i) => (i.id === productId ? { ...i, qty } : i))
    )
  }

  function clearCart() {
    updateCart(() => [])
  }

  const totalItems = cart.reduce((sum, i) => sum + i.qty, 0)

  return { cart, addItem, removeItem, setQuantity, clearCart, totalItems }
}
