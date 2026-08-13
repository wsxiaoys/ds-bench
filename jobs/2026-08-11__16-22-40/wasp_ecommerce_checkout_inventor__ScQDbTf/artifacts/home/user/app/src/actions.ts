import { prisma } from "wasp/server"
import { type Checkout } from "wasp/server/operations"
import { HttpError } from "wasp/server"

export const checkout: Checkout<{
  items: { productId: number; quantity: number }[]
  couponCode?: string
}, { orderId: number }> = async (args, context) => {
  const { items, couponCode } = args

  if (!items || items.length === 0) {
    throw new HttpError(400, "Cart is empty")
  }

  for (const item of items) {
    if (item.quantity <= 0) {
      throw new HttpError(400, "Quantity must be greater than 0")
    }
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Sort product IDs to prevent deadlocks
    const sortedProductIds = [...new Set(items.map(item => item.productId))].sort((a, b) => a - b)

    // 2. Lock and fetch products
    const lockedProducts: Record<number, any> = {}
    for (const productId of sortedProductIds) {
      const rows = await tx.$queryRaw<any[]>`
        SELECT id, name, price, inventory FROM "Product" WHERE id = ${productId} FOR UPDATE
      `
      if (rows.length === 0) {
        throw new HttpError(404, `Product with ID ${productId} not found`)
      }
      lockedProducts[productId] = rows[0]
    }

    // 3. Validate inventories and calculate subtotal
    let subtotal = 0
    const orderItemsToCreate: { productId: number; quantity: number; price: number }[] = []

    for (const item of items) {
      const product = lockedProducts[item.productId]
      if (!product) {
        throw new HttpError(404, `Product with ID ${item.productId} not found`)
      }

      if (product.inventory < item.quantity) {
        throw new HttpError(400, `Insufficient inventory for ${product.name}. Available: ${product.inventory}, requested: ${item.quantity}`)
      }

      subtotal += product.price * item.quantity
      orderItemsToCreate.push({
        productId: item.productId,
        quantity: item.quantity,
        price: product.price
      })
    }

    // 4. Validate and apply coupon if provided
    let discount = 0
    let finalCouponCode: string | null = null

    if (couponCode && couponCode.trim() !== "") {
      const coupon = await tx.coupon.findUnique({
        where: { code: couponCode.toUpperCase().trim() }
      })
      if (!coupon) {
        throw new HttpError(404, "Invalid coupon code")
      }
      finalCouponCode = coupon.code

      if (coupon.type === "PERCENTAGE") {
        discount = subtotal * (coupon.value / 100)
      } else if (coupon.type === "FLAT") {
        discount = coupon.value
      }
    }

    const total = Math.max(0, subtotal - discount)

    // 5. Decrement inventory for each product
    for (const item of items) {
      const product = lockedProducts[item.productId]
      await tx.product.update({
        where: { id: item.productId },
        data: {
          inventory: product.inventory - item.quantity
        }
      })
    }

    // 6. Create the Order and OrderItems
    const order = await tx.order.create({
      data: {
        subtotal,
        discount,
        total,
        couponCode: finalCouponCode,
        items: {
          create: orderItemsToCreate.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price
          }))
        }
      }
    })

    return { orderId: order.id }
  })
}
