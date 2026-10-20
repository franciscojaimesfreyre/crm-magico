-- Atracciones del catálogo que cierra una novedad de cierre o remodelación.
ALTER TABLE "KnowledgeItem" ADD COLUMN "closesEntryIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "closesManual" BOOLEAN NOT NULL DEFAULT false;
