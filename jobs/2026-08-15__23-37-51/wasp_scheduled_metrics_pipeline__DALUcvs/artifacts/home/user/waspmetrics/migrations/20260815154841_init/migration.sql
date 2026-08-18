-- CreateTable
CREATE TABLE "Sample" (
    "id" SERIAL NOT NULL,
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RollupResult" (
    "id" SERIAL NOT NULL,
    "metric" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "p95" DOUBLE PRECISION,
    "avg" DOUBLE PRECISION,
    "delta" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RollupResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Sample_idempotencyKey_key" ON "Sample"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "RollupResult_metric_key" ON "RollupResult"("metric");
