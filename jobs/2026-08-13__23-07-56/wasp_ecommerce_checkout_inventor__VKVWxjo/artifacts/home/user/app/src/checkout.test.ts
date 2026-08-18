import { PrismaClient } from "@prisma/client";
import { checkout } from "./actions";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const prisma = new PrismaClient();

describe("Concurrent Checkout Tests", () => {
  beforeAll(async () => {
    // Ensure we have the keyboard product with inventory of 1
    await prisma.product.upsert({
      where: { id: 2 },
      update: { inventory: 1, price: 150.00 },
      create: { id: 2, name: "Ergonomic Mechanical Keyboard", price: 150.00, inventory: 1 }
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should allow only one checkout to succeed when inventory is 1 under high concurrency", async () => {
    const context = { prisma, entities: {} };
    const checkoutArgs = {
      items: [{ productId: 2, quantity: 1 }]
    };

    // Trigger 5 concurrent checkouts
    const promises = Array.from({ length: 5 }).map(() =>
      checkout(checkoutArgs, context)
        .then(res => ({ success: true, res, error: null }))
        .catch(err => ({ success: false, res: null, error: err.message as string }))
    );

    const results = await Promise.all(promises);

    const successes = results.filter(r => r.success);
    const failures = results.filter(r => !r.success);

    console.log("Successes count:", successes.length);
    console.log("Failures count:", failures.length);

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(4);

    // Verify all failures have out-of-stock or inventory error
    failures.forEach(f => {
      expect(f.error).toMatch(/inventory|stock/i);
    });

    // Verify final inventory is 0
    const finalProduct = await prisma.product.findUnique({ where: { id: 2 } });
    expect(finalProduct?.inventory).toBe(0);
  });
});
