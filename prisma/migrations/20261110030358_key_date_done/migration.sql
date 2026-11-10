-- CreateTable
CREATE TABLE "KeyDateDone" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KeyDateDone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KeyDateDone_bookingId_key_key" ON "KeyDateDone"("bookingId", "key");

-- AddForeignKey
ALTER TABLE "KeyDateDone" ADD CONSTRAINT "KeyDateDone_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
