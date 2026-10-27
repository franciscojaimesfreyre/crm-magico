import Link from "next/link";
import { CalendarDays, FileSpreadsheet, MessageCircle, Workflow, Wand2, Users } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { YornoLogo } from "@/components/brand";

const FEATURES = [
  { icon: Users, title: "Clientes y familias", text: "Perfiles con viajeros, edades, alturas, preferencias y fechas importantes." },
  { icon: Wand2, title: "Itinerarios con IA", text: "La IA arma planes día por día usando las novedades que cargamos todo el tiempo." },
  { icon: CalendarDays, title: "Pipeline y fechas clave", text: "Cada viaje con todas sus reservas (paquete, tickets, auto, hotel), con avisos de restaurantes, Lightning Lane y pagos." },
  { icon: MessageCircle, title: "Portal del viajero", text: "Tus clientes ven su viaje, itinerario y documentos, y te escriben ahí." },
  { icon: FileSpreadsheet, title: "Planillas de comisiones", text: "Generá la planilla para la agencia y marcá lo que ya cobraste." },
  { icon: Workflow, title: "Automatizaciones", text: "Tareas y emails que salen solos según las fechas de cada viaje." },
];

/** Portada: el Verde noche con el logotipo en crema y un solo mensaje; abajo, sobre el crema, lo que hace Yorno. */
export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--ground)]">
      <section className="bg-[var(--night)] text-[var(--ground)]">
        <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <Link href="/" aria-label="Yorno" className="text-[var(--ground)]">
            <YornoLogo className="h-9" title={null} />
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/portal/login" className="rounded-[10px] px-3 py-2 text-[var(--ground)]/80 hover:text-[var(--ground)]">
              Portal del viajero
            </Link>
            <Link href="/login" className={buttonClass("secondary", "sm", "border-transparent")}>
              Ingresar
            </Link>
          </nav>
        </header>
        <div className="mx-auto max-w-6xl px-6 pt-16 pb-24 sm:pt-24 sm:pb-32">
          <p className="text-[13px] font-semibold tracking-[0.12em] text-[var(--mint)] uppercase">CRM para agentes de viaje</p>
          <h1 className="mt-4 max-w-3xl text-[40px] leading-[1.05] font-bold tracking-[-0.02em] sm:text-[56px]">
            Todas tus reservas, pagos y familias en un solo lugar.
          </h1>
          <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-[var(--ground)]/80">
            Clientes, cotizaciones, reservas, itinerarios y seguimiento de cada viaje a parques temáticos y destinos de entretenimiento. Cada día del viaje, en orden.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/registro" className={buttonClass("primary", "md", "h-12 px-6 text-[15px]")}>
              Crear cuenta gratis
            </Link>
            <Link href="/login" className={buttonClass("ghost", "md", "h-12 px-6 text-[15px] text-[var(--ground)] hover:bg-white/10 active:bg-white/15")}>
              Ya tengo cuenta
            </Link>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="max-w-2xl text-[32px] leading-tight text-slate-900">Ordenamos tu trabajo para que el viaje de tu cliente salga perfecto.</h2>
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl bg-white p-6">
              <f.icon className="size-6 text-brand-600" strokeWidth={1.75} />
              <h3 className="mt-4 text-lg text-slate-900">{f.title}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-slate-600">{f.text}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="mx-auto flex max-w-6xl items-end justify-between gap-6 border-t border-[var(--border)] px-6 py-10">
        <YornoLogo className="h-7 text-[var(--night)]" />
        <p className="text-sm text-[var(--ink-soft)]">Cada día del viaje, en orden.</p>
      </footer>
    </div>
  );
}
