import { type } from "arktype"

interface Product {
  id: string
  sku: string
  price: number
  tags: string[]
}

// Form A: type.declare<Product>().type({...})
try {
  const schema = type.declare<Product>().type({
    id: "string",
    sku: "string",
    price: "number",
    tags: "string[]"
  })
  console.log("FormA OK", typeof schema)
} catch (e) {
  console.log("FormA ERR", e instanceof Error ? e.message : e)
}

// Form B: type.declare<Product>()({...})
try {
  const schema = (type.declare<Product>() as any)({
    id: "string",
    sku: "string",
    price: "number",
    tags: "string[]"
  })
  console.log("FormB OK", typeof schema)
} catch (e) {
  console.log("FormB ERR", e instanceof Error ? e.message : e)
}