import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

// Una sola familia: Inter, con los títulos en bold de tracking cerrado (como la referencia).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "CRM Mágico", template: "%s · CRM Mágico" },
  description: "CRM para agentes de viajes especializados en Disney y Universal",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={cn("h-full antialiased", inter.variable, geistMono.variable)}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
