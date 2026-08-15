-- CreateTable
CREATE TABLE "Sample" (
    "id" SERIAL NOT NULL,
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotencyKey" TEXT NOT NULL,

    CONSTRAINT "Sample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricRollup" (
    "metric" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "p95" DOUBLE PRECISION,
    "avg" DOUBLE PRECISION,
    "delta" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetricRollup_pkey" PRIMARY KEY ("metric")
);

-- CreateIndex
CREATE UNIQUE INDEX "Sample_idempotencyKey_key" ON "Sample"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Sample_metric_recordedAt_idx" ON "Sample"("metric", "recordedAt");
