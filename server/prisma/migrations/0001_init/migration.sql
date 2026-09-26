-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MESS_MANAGER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "menu_master" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "day" TEXT NOT NULL,
    "lunch" TEXT NOT NULL,
    "dinner" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "meals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "day" TEXT NOT NULL,
    "mealType" TEXT NOT NULL,
    "menu" TEXT NOT NULL,
    "hostelStudents" INTEGER NOT NULL,
    "expectedStudents" INTEGER NOT NULL,
    "holiday" BOOLEAN NOT NULL DEFAULT false,
    "collegeStatus" TEXT NOT NULL,
    "event" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "meal_results" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mealId" TEXT NOT NULL,
    "predictedConsumption" INTEGER NOT NULL,
    "recommendedQuantity" INTEGER NOT NULL,
    "preparedQuantity" INTEGER NOT NULL,
    "consumedQuantity" INTEGER NOT NULL,
    "waste" INTEGER NOT NULL,
    "shortage" INTEGER NOT NULL,
    "wastePercentage" REAL NOT NULL,
    "predictionError" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "meal_results_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "meals" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "menu_master_day_key" ON "menu_master"("day");

-- CreateIndex
CREATE UNIQUE INDEX "holidays_date_key" ON "holidays"("date");

-- CreateIndex
CREATE INDEX "meals_date_idx" ON "meals"("date");

-- CreateIndex
CREATE INDEX "meals_menu_idx" ON "meals"("menu");

-- CreateIndex
CREATE UNIQUE INDEX "meal_results_mealId_key" ON "meal_results"("mealId");
