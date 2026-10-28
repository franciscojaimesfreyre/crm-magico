import type { Metadata } from "next";
import { Geist_Mono, Outfit } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

// Texto e interfaz en Outfit, como pide el manual de marca (el logotipo es un SVG, no una tipografía).
const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Yiorno", template: "%s · Yiorno" },
  description: "El CRM para agentes de viaje que venden paquetes a parques temáticos y destinos de entretenimiento.",
  applicationName: "Yiorno",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={cn("h-full antialiased", outfit.variable, geistMono.variable)}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
