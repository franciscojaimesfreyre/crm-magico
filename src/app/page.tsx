import Link from "next/link";
import { CalendarDays, FileSpreadsheet, MessageCircle, Sparkles, Wand2, Users } from "lucide-react";
import { buttonClass } from "@/components/ui";

const FEATURES = [
  { icon: Users, title: "Clientes y familias", text: "Perfiles con viajeros, edades, alturas, preferencias y fechas importantes." },
  { icon: Wand2, title: "Itinerarios con IA", text: "La IA arma planes día por día usando las novedades que cargamos todo el tiempo." },
  { icon: CalendarDays, title: "Pipeline y fechas clave", text: "Cada viaje con todas sus reservas (paquete, tickets, auto, hotel), con avisos de restaurantes, Lightning Lane y pagos." },
  { icon: MessageCircle, title: "Portal del viajero", text: "Tus clientes ven su viaje, itinerario y documentos, y te escriben ahí." },
  { icon: FileSpreadsheet, title: "Planillas de comisiones", text: "Generá la planilla para la agencia y marcá lo que ya cobraste." },
  { icon: Sparkles, title: "Automatizaciones", text: "Tareas y emails que salen solos según las fechas de cada viaje." },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-900 via-brand-700 to-fuchsia-600 text-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Sparkles className="size-5" /> CRM Mágico
        </div>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/portal/login" className="text-white/80 hover:text-white">
            Portal del viajero
          </Link>
          <Link href="/login" className={buttonClass("secondary", "sm")}>
            Ingresar
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-6 pt-16 pb-24">
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          El CRM para agentes especializados en Disney y Universal
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-white/80">
          Cotizaciones, itinerarios y seguimiento de cada viaje en un solo lugar, con una IA que conoce las últimas novedades de los parques.
        </p>
        <div className="mt-8 flex gap-3">
          <Link href="/registro" className={buttonClass("secondary")}>
            Crear cuenta gratis
          </Link>
        </div>
        <div className="mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl bg-white/10 p-6 backdrop-blur">
              <f.icon className="size-6 text-fuchsia-200" />
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-white/75">{f.text}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
