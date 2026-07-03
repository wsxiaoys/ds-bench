-- CreateTable
CREATE TABLE "Item" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "Item_tenantId_idx" ON "Item"("tenantId");
