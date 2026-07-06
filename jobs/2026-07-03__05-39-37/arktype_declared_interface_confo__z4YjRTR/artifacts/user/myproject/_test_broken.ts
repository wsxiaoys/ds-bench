import { type } from "arktype"

interface Product {
  id: string
  sku: string
  price: number
  tags: string[]
}

// broken: omits tags -> should be a TS error
const broken = type.declare<Product>().type({
  id: "string",
  sku: "string",
  price: "number"
})

export { broken }