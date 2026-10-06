-- Cada Organization pasa a ser el negocio de un agente, con una sola agencia (opcional) que le paga
-- las comisiones. Las agencias pueden tener usuarios propios y ver los números de sus agentes.

-- Roles: OWNER deja de existir (cada agente maneja su propia cuenta).
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('AGENT', 'AGENCY');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING ('AGENT'::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "UserRole_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'AGENT';
COMMIT;

-- Nuevas columnas.
ALTER TABLE "Organization" ADD COLUMN "agencyId" TEXT,
ADD COLUMN "agencyJoinedAt" TIMESTAMP(3);

ALTER TABLE "Agency" ADD COLUMN "inviteCode" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Agency" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "User" ADD COLUMN "agencyId" TEXT,
ALTER COLUMN "organizationId" DROP NOT NULL;

-- Cada agente se queda con la agencia que más usó en sus reservas (o la primera que cargó).
UPDATE "Organization" o
SET "agencyId" = (
  SELECT a."id"
  FROM "Agency" a
  WHERE a."organizationId" = o."id"
  ORDER BY (SELECT count(*) FROM "Booking" b WHERE b."agencyId" = a."id") DESC, a."createdAt" ASC
  LIMIT 1
);

-- Las demás agencias se borran, salvo que figuren en alguna planilla ya generada.
DELETE FROM "Agency" a
WHERE NOT EXISTS (SELECT 1 FROM "Organization" o WHERE o."agencyId" = a."id")
  AND NOT EXISTS (SELECT 1 FROM "CommissionStatement" s WHERE s."agencyId" = a."id");

-- La agencia ya no cuelga de la organización ni se elige por reserva.
ALTER TABLE "Agency" DROP CONSTRAINT "Agency_organizationId_fkey";
ALTER TABLE "Agency" DROP COLUMN "organizationId";
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_agencyId_fkey";
ALTER TABLE "Booking" DROP COLUMN "agencyId";

CREATE UNIQUE INDEX "Agency_inviteCode_key" ON "Agency"("inviteCode");

ALTER TABLE "Organization" ADD CONSTRAINT "Organization_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "User" ADD CONSTRAINT "User_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
