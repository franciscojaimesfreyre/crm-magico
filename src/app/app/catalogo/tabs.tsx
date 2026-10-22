import { Tabs } from "@/components/ui";

/** Pestañas del catálogo: lugares sueltos (atracciones, shows, restaurantes) y fichas de parques. */
export function CatalogTabs({ active }: { active: "lugares" | "fichas" }) {
  return (
    <Tabs
      active={active}
      tabs={[
        { key: "lugares", label: "Atracciones y lugares", href: "/app/catalogo" },
        { key: "fichas", label: "Fichas de parques", href: "/app/catalogo/fichas" },
      ]}
    />
  );
}
