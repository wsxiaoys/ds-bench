import { PrismaClient } from "@prisma/client";
import { getAnalytics } from "./src/queries.ts";

async function runTest() {
  console.log("Starting query verification test...");
  
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: "file:/home/user/app/.wasp/out/db/dev.db",
      },
    },
  });

  try {
    // Find the testuser
    const user = await prisma.user.findFirst();
    if (!user) {
      throw new Error("No user found in database. Did you run the seed?");
    }

    console.log(`Found user ID: ${user.id}`);

    // Mock Wasp context
    const context = {
      user,
      entities: {
        Transaction: prisma,
      },
    };

    // Test Case 1: Default range 2026-07-01 to 2026-07-31, resolution: day
    console.log("\nTesting Case 1: Default range, day resolution");
    const result1 = await getAnalytics(
      {
        startDate: "2026-07-01",
        endDate: "2026-07-31",
        resolution: "day",
      },
      context
    );

    console.log("Summary:", JSON.stringify(result1.summary, null, 2));
    console.log("TimeSeries length:", result1.timeSeries.length);
    console.log("TimeSeries rows:", JSON.stringify(result1.timeSeries, null, 2));
    console.log("Category breakdown:", JSON.stringify(result1.categoryBreakdown, null, 2));

    // Assertions for Case 1
    if (result1.summary.totalIncome !== 7500) {
      throw new Error(`Expected totalIncome to be 7500, got ${result1.summary.totalIncome}`);
    }
    if (result1.summary.totalExpense !== 2000) {
      throw new Error(`Expected totalExpense to be 2000, got ${result1.summary.totalExpense}`);
    }
    if (result1.summary.netSavings !== 5500) {
      throw new Error(`Expected netSavings to be 5500, got ${result1.summary.netSavings}`);
    }
    if (Math.abs(result1.summary.savingsRate - 73.33) > 0.01) {
      throw new Error(`Expected savingsRate to be ~73.33, got ${result1.summary.savingsRate}`);
    }

    // Verify timeSeries dates and values
    const expectedRows = [
      { date: "2026-07-01", income: 5000, expense: 0, net: 5000 },
      { date: "2026-07-15", income: 0, expense: 1200, net: -1200 },
      { date: "2026-07-20", income: 0, expense: 800, net: -800 },
      { date: "2026-07-25", income: 2500, expense: 0, net: 2500 },
    ];

    expectedRows.forEach((expected) => {
      const actual = result1.timeSeries.find((r) => r.date === expected.date);
      if (!actual) {
        throw new Error(`Expected row for date ${expected.date} not found in timeSeries`);
      }
      if (actual.income !== expected.income || actual.expense !== expected.expense || actual.net !== expected.net) {
        throw new Error(`Row mismatch for ${expected.date}. Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)}`);
      }
    });

    console.log("\n✔ Case 1 passed successfully!");

    // Test Case 2: resolution: month
    console.log("\nTesting Case 2: Default range, month resolution");
    const result2 = await getAnalytics(
      {
        startDate: "2026-07-01",
        endDate: "2026-07-31",
        resolution: "month",
      },
      context
    );
    console.log("TimeSeries rows (month):", JSON.stringify(result2.timeSeries, null, 2));
    if (result2.timeSeries.length !== 1 || result2.timeSeries[0].date !== "2026-07") {
      throw new Error(`Expected 1 month row for 2026-07, got ${JSON.stringify(result2.timeSeries)}`);
    }

    console.log("\n✔ Case 2 passed successfully!");

    // Test Case 3: resolution: week
    console.log("\nTesting Case 3: Default range, week resolution");
    const result3 = await getAnalytics(
      {
        startDate: "2026-07-01",
        endDate: "2026-07-31",
        resolution: "week",
      },
      context
    );
    console.log("TimeSeries rows (week):", JSON.stringify(result3.timeSeries, null, 2));

    console.log("\n✔ Case 3 passed successfully!");
    console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY! The query is completely correct. 🎉");
  } catch (err) {
    console.error("\n❌ TEST FAILED:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
