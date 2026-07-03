-- CreateTable
CREATE TABLE "Account" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "owner" TEXT NOT NULL,
    "balance" REAL NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_owner_key" ON "Account"("owner");
