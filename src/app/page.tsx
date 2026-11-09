import Link from "next/link";
import clsx from "clsx";
import { YiornoLogo, YiornoMonogram } from "@/components/brand";
import { NewsTicker } from "@/components/landing/news-ticker";
import { HeroTrail } from "@/components/landing/hero-trail";
import { TripPath } from "@/components/landing/trip-path";
import { FeaturePin, type Feature } from "@/components/landing/feature-pin";
import { SignupDialog } from "@/components/landing/signup-dialog";
import { Reveal } from "@/components/landing/reveal";
import { CHARACTERS, characterSrc } from "@/lib/media";
import "./landing.css";

export const metadata = {
  title: { absolute: "Yiorno · El CRM para agentes de viaje" },
  description:
    "CRM para agentes de viaje: clientes, reservas, pagos y saldos, itinerarios con IA y fechas clave calculadas solas. Para cualquier viaje, con lo que hace falta para vender Disney y Universal.",
};

/** De la consulta al viaje: cada estación del camino, con su captura de la app. */
const STOPS = [
  {
    title: "Llega la consulta",
    text: "Cargás a los viajeros una sola vez: quiénes viajan, edades, alturas y qué les gusta. El viaje entra al tablero y desde ahí no se pierde.",
    image: "/landing/app-02-viajes-tablero.webp",
    alt: "Tablero de viajes de Yiorno con las columnas Consulta, Cotizado, Reservado y Pagado",
    character: "princesa",
  },
  {
    title: "Cotizás y reservás",
    text: "Vuelos, hotel, paquete, entradas, auto, traslados y seguro en una ficha. Cada reserva con su proveedor, su confirmación, lo pagado y el saldo.",
    image: "/landing/app-04-viaje-resumen.webp",
    alt: "Ficha de un viaje en Yiorno con el banner, las fechas, la cuenta regresiva y los montos",
    character: "astronauta",
  },
];

const FEATURES: Feature[] = [
  {
    title: "Tu día, de un vistazo",
    text: "Al entrar ves lo que necesita tu atención: saldos por vencer, fechas clave de la semana, tareas atrasadas y consultas nuevas.",
    image: "/landing/app-01-inicio.webp",
    alt: "Inicio de Yiorno con lo que necesita atención y las cifras del negocio",
  },
  {
    title: "Comisiones que no se escapan",
    text: "Cada reserva lleva su comisión. Armás la planilla para la agencia operadora y marcás lo cobrado, así sabés qué te deben.",
    image: "/landing/app-12-comisiones.webp",
    alt: "Comisiones por cobrar y planilla para la agencia",
  },
  {
    title: "Tu negocio en números",
    text: "Ventas, comisión por mes, por destino y por proveedor. Para saber qué vendés y cuánto ganás, sin armar planillas.",
    image: "/landing/app-13-reportes.webp",
    alt: "Reportes de ventas y comisiones por mes y por destino",
  },
];

/** Lo que tiene en cuenta la IA al armar un itinerario. */
const AI_POINTS = [
  { title: "Evita lo que está cerrado", text: "Si una atracción o un parque cierra esas fechas, no entra en el plan." },
  { title: "Respeta edades y alturas", text: "Cada atracción se cruza con la altura de cada viajero, y el sistema avisa si alguno no llega." },
  { title: "Suma lo que pasa durante el viaje", text: "Fiestas, shows, festivales y aperturas que caen en las fechas del viaje." },
];

/** Lo que incluye el plan: todo Yiorno, sin funciones bloqueadas. */
const INCLUDED = [
  "Clientes, viajeros, viajes y cotizaciones",
  "Fechas clave y avisos automáticos",
  "Reservas de vuelos, hoteles, autos y parques, con sus pagos, saldos y vencimientos",
  "10 itinerarios con IA por mes",
  "Novedades diarias y fichas de parques con horarios",
  "Portal para tus viajeros con la marca de tu agencia",
  "Mensajes con cada viajero",
  "Comisiones, planillas y reportes",
];

const FACTS = [
  { value: "30", unit: "días antes", text: "vence el saldo del paquete. Yiorno te lo marca antes, con lo que falta cobrar." },
  { value: "7", unit: "días antes", text: "se reservan los pases rápidos si se alojan en un hotel de Disney" },
  { value: "1", unit: "día antes", text: "abre el check-in online de cada vuelo" },
];

/** Las preguntas, en el orden en que las hace quien llega de un buscador; también van como datos estructurados (FAQPage). */
const FAQ = [
  {
    q: "¿Qué es Yiorno?",
    a: "Un CRM para agentes de viaje. En un solo lugar cargás clientes y viajeros, cotizás, registrás reservas y pagos, y Yiorno te avisa cuándo vence cada saldo. Además arma itinerarios con IA y les da a tus viajeros un portal para seguir su viaje. Sirve para cualquier destino, con herramientas extra para Disney y Universal.",
  },
  {
    q: "¿Qué destinos puedo cargar?",
    a: "Cualquiera, en cualquier parte del mundo. Cargás vuelos, hoteles, autos, cruceros, paquetes y combinados. Si el viaje es a Disney o Universal, además tenés fichas de parques con horarios y las novedades del día.",
  },
  {
    q: "¿Qué hace la IA?",
    a: "Arma un borrador del itinerario día por día con las novedades de los parques que cargamos todo el tiempo. Vos lo revisás y lo ajustás antes de compartirlo.",
  },
  {
    q: "¿Cuánto cuesta Yiorno?",
    a: "Es gratis mientras dure la beta. Después cuesta US$ 20 por mes por agente, con todo incluido. Si sos una agencia con varios agentes, escribinos a info@yiorno.app y armamos un plan para tu equipo.",
  },
  {
    q: "¿Tengo que instalar algo?",
    a: "No. Yiorno funciona en el navegador: creás la cuenta y cargás tu primer viaje el mismo día.",
  },
  {
    q: "¿Cómo entran los viajeros a su portal?",
    a: "Les compartís un código o un link desde el viaje. Crean su cuenta y ven el viaje, el itinerario día por día y los documentos.",
  },
  {
    q: "Trabajo con una agencia, ¿puedo usarlo?",
    a: "Sí. Cargás el código de tu agencia y ella ve tus ventas y comisiones en un panel de solo lectura.",
  },
];

/** Datos estructurados para los buscadores: qué es Yiorno, su precio y las preguntas frecuentes. */
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "Yiorno",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description: FAQ[0].a,
      email: "info@yiorno.app",
      offers: { "@type": "Offer", price: "20", priceCurrency: "USD", description: "Por agente, por mes. Gratis durante la beta." },
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ],
};

const color = (id: string) => CHARACTERS.find((c) => c.id === id)?.color;
const delay = (ms: number) => ({ "--delay": `${ms}ms` }) as React.CSSProperties;
const d = (n: number) => ({ "--d": n }) as React.CSSProperties;

/**
 * Portada de Yiorno. El nombre viene de "giorno" (día): el primer pantallazo dibuja el camino de los días de un
 * viaje, y la página sigue el camino de un viaje, de la consulta a los viajeros en el parque, con capturas reales
 * de la app en cada estación.
 */
export default function Home() {
  return (
    <div className="landing min-h-svh overflow-x-clip">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD).replace(/</g, "\\u003c") }} />
      {/* Barra flotante: logo, tres secciones y la acción. */}
      <header className="fixed inset-x-0 top-3 z-50 px-3 sm:top-4">
        <nav className="mx-auto flex h-16 max-w-[1120px] items-center gap-2 rounded-2xl bg-white pr-2.5 pl-5 shadow-[0_8px_30px_-12px_rgb(15_47_43/0.25)] sm:pl-6">
          <Link href="/" aria-label="Yiorno, inicio" className="mr-auto text-[var(--night)]">
            {/* Se baja un poco: así el cuerpo de la palabra (sin el punto de la "i" ni la cola de la "y") queda centrado en la barra. */}
            <YiornoLogo className="h-10 translate-y-[11%] sm:h-12" title={null} />
          </Link>
          <div className="hidden items-center gap-1 text-[15px] md:flex">
            <a href="#camino" className="rounded-[10px] px-3 py-2 hover:bg-[var(--raised)]">
              Cómo funciona
            </a>
            <a href="#viajeros" className="rounded-[10px] px-3 py-2 hover:bg-[var(--raised)]">
              Portal del viajero
            </a>
            <a href="#precio" className="rounded-[10px] px-3 py-2 hover:bg-[var(--raised)]">
              Precio
            </a>
            <a href="#preguntas" className="rounded-[10px] px-3 py-2 hover:bg-[var(--raised)]">
              Preguntas
            </a>
          </div>
          <Link href="/login" className="rounded-[10px] px-2.5 py-2 text-[15px] whitespace-nowrap hover:bg-[var(--raised)] sm:px-3">
            Ingresar
          </Link>
          <Link href="/registro" className="press inline-flex h-11 items-center rounded-[10px] bg-brand-600 px-4 text-[15px] font-semibold whitespace-nowrap text-white hover:bg-brand-700">
            Crear cuenta
          </Link>
        </nav>
      </header>

      {/* Primer pantallazo: el titular enorme sobre el Verde Yiorno y el camino de los días dibujándose. */}
      <section className="flex flex-col bg-brand-600 text-[var(--ground)] sm:min-h-svh">
        <div className="flex flex-1 flex-col items-center justify-center px-[var(--gutter)] pt-28 pb-12 text-center sm:pt-24">
          <h1 className="text-[length:var(--t-display)] leading-[0.92] font-bold">
            <span className="rise block" style={delay(0)}>
              Cada día del viaje,
            </span>
            <span className="rise block" style={delay(110)}>
              en orden.
            </span>
          </h1>
          <p className="rise mt-8 max-w-[58ch] text-[length:var(--t-lead)] text-balance text-[var(--ground)]/90" style={delay(250)}>
            El CRM para agentes de viaje. Clientes, reservas, saldos e itinerarios con IA en un solo lugar. Sirve para cualquier viaje y trae todo
            lo que hace falta para vender Disney y Universal.
          </p>
          <div className="rise mt-9 flex flex-wrap justify-center gap-3" style={delay(350)}>
            <Link href="/registro" className="press inline-flex h-[52px] items-center rounded-[10px] bg-[var(--ground)] px-7 text-base font-semibold text-[var(--night)] hover:bg-white">
              Crear cuenta gratis
            </Link>
            <a href="#camino" className="press inline-flex h-[52px] items-center rounded-[10px] px-6 text-base font-semibold text-[var(--ground)] ring-2 ring-[var(--ground)]/40 hover:ring-[var(--ground)]">
              Ver cómo funciona
            </a>
          </div>
        </div>
        <HeroTrail />
      </section>

      {/* El crema que sigue es el piso donde aterrizan los días: sin borde ni corte entre las dos secciones. */}
      <main className="relative bg-[var(--ground)]">
        <Reveal>
          <section aria-labelledby="intro" className="grid gap-8 px-[var(--gutter)] pt-20 pb-10 lg:grid-cols-12 lg:pt-28">
            <h2 id="intro" data-reveal className="text-[length:var(--t-h2)] leading-[1.02] lg:col-span-6">
              Vos vendés. Yiorno se acuerda de todo.
            </h2>
            <div className="lg:col-span-5 lg:col-start-8 lg:pt-3" data-reveal style={d(1)}>
              <p className="text-[length:var(--t-lead)]">
                Un saldo que vence sin aviso, un check-in que se pasa, una altura mínima que nadie miró. Cada grupo de viajeros trae decenas de fechas,
                y una sola que se escape cuesta plata y arruina un viaje esperado durante meses.
              </p>
              <p className="mt-5 text-slate-700">Yiorno las calcula solas, te avisa a tiempo y les muestra a los viajeros lo que tienen que saber.</p>
            </div>
            {/* Algunas de las fechas que calcula, en cifras grandes. */}
            <dl className="grid overflow-hidden rounded-[28px] bg-white sm:grid-cols-3 lg:col-span-12 lg:mt-6">
              {FACTS.map((f, i) => (
                <div key={f.text} data-reveal style={d(i + 1)} className="border-[var(--sand)] p-7 max-sm:border-b max-sm:last:border-b-0 sm:border-r sm:last:border-r-0 lg:p-8">
                  <dt>
                    <span className="figure block text-[clamp(64px,6vw,96px)] leading-none text-brand-600">{f.value}</span>
                    <span className="mt-2 block text-[length:var(--t-lead)] font-semibold">{f.unit}</span>
                  </dt>
                  <dd className="mt-1 text-slate-700">{f.text}</dd>
                </div>
              ))}
            </dl>
          </section>
        </Reveal>

        {/* El camino del viaje: la cinta verde une las estaciones, de la consulta a los viajeros en el parque. */}
        <section id="camino" aria-labelledby="camino-t" className="scroll-mt-24 px-[var(--gutter)] pt-14 pb-24 lg:pb-36">
          <Reveal>
            <h2 id="camino-t" data-reveal className="mx-auto max-w-[16ch] text-center text-[length:var(--t-h2)] leading-[1.02]">
              Del primer mensaje al último día
            </h2>
          </Reveal>
          <TripPath>
            <Reveal className="mt-16 space-y-20 lg:mt-24 lg:space-y-32">
              {STOPS.map((s, i) => {
                const flip = i % 2 === 1;
                return (
                  <div key={s.title} data-stop className="relative grid items-center gap-8 lg:grid-cols-12 lg:gap-10">
                    <div data-reveal className={clsx("relative z-10 rounded-[28px] bg-white p-7 sm:p-9 lg:col-span-5", flip ? "lg:col-start-8 lg:row-start-1" : "lg:col-start-1")}>
                      <h3 className="text-[length:var(--t-h3)] leading-tight">{s.title}</h3>
                      <p className="mt-3 text-slate-700">{s.text}</p>
                    </div>
                    <div data-reveal style={d(1)} className={clsx("relative z-10", flip ? "lg:col-span-6 lg:col-start-1 lg:row-start-1" : "lg:col-span-6 lg:col-start-7")}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.image} alt={s.alt} width={1600} height={1000} loading="lazy" className="lift w-full rounded-[20px] border-[6px] border-white bg-white" />
                      {/* El personaje que acompaña cada tramo del camino. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={characterSrc(s.character)}
                        alt=""
                        width={112}
                        height={112}
                        loading="lazy"
                        style={{ backgroundColor: color(s.character), "--r": flip ? "-5deg" : "5deg", rotate: flip ? "-5deg" : "5deg" } as React.CSSProperties}
                        className={clsx("bob absolute -top-8 size-20 rounded-[22px] border-4 border-[var(--ground)] sm:size-28", flip ? "-left-3 sm:-left-6" : "-right-3 sm:-right-6")}
                      />
                    </div>
                  </div>
                );
              })}
            </Reveal>
          </TripPath>
        </section>

        {/* La IA arma itinerarios con lo que pasa hoy en los parques: novedades que pasan y la captura del editor. */}
        <section id="ia" aria-labelledby="ia-t" className="scroll-mt-24 overflow-hidden bg-brand-600 pt-24 pb-24 text-[var(--ground)] lg:pt-32 lg:pb-32">
          <Reveal className="grid gap-8 px-[var(--gutter)] lg:grid-cols-12">
            <h2 id="ia-t" data-reveal className="text-[length:var(--t-h2)] leading-[1.02] lg:col-span-7">
              Itinerarios con IA, al día con los parques.
            </h2>
            <div data-reveal style={d(1)} className="lg:col-span-5 lg:pt-3">
              <p className="text-[length:var(--t-lead)]">
                Todos los días cargamos lo que cambia en Disney, Universal y los cruceros: cierres, remodelaciones, horarios, eventos, aperturas y
                promociones.
              </p>
              <p className="mt-4 text-[var(--ground)]/85">
                La IA arma el itinerario con eso a la vista y con lo que sabés de tus viajeros: edades, alturas, gustos, reservas y vuelos.
              </p>
            </div>
          </Reveal>
          <NewsTicker />
          <Reveal className="mt-14 grid items-center gap-10 px-[var(--gutter)] lg:mt-20 lg:grid-cols-12 lg:gap-12">
            <ul className="space-y-3 lg:col-span-4">
              {AI_POINTS.map((p, i) => (
                <li key={p.title} data-reveal style={d(i)} className="rounded-[20px] bg-[var(--ground)]/10 p-6">
                  <p className="text-[length:var(--t-h3)] leading-tight font-semibold">{p.title}</p>
                  <p className="mt-2 text-[var(--ground)]/85">{p.text}</p>
                </li>
              ))}
            </ul>
            <div data-reveal style={d(1)} className="relative lg:col-span-8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/landing/app-18-itinerario-ia.webp"
                alt="Editor del itinerario con el panel Itinerario con IA abierto: nivel de detalle, recomendaciones e instrucciones"
                width={1600}
                height={1000}
                loading="lazy"
                className="w-full rounded-[20px] border-[6px] border-white/90 bg-white"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/landing/app-19-novedades.webp"
                alt="Novedades de los parques que usa la IA: eventos, promociones, cierres y aperturas"
                width={1600}
                height={1000}
                loading="lazy"
                className="lift absolute -bottom-10 -left-6 hidden w-[46%] rounded-[16px] border-[5px] border-white bg-white shadow-[0_24px_50px_-20px_rgb(0_0_0/0.45)] lg:block"
              />
            </div>
          </Reveal>
          <div className="mt-20 flex justify-center px-[var(--gutter)]">
            <Link href="/registro" className="press inline-flex h-[52px] items-center rounded-[10px] bg-[var(--ground)] px-7 text-base font-semibold text-[var(--night)] hover:bg-white">
              Probá el itinerario con IA
            </Link>
          </div>
        </section>

        {/* Todo lo demás, en un bloque Verde noche que queda fijo mientras se recorren las funciones. */}
        <section aria-labelledby="todo" className="bg-[var(--night)] px-[var(--gutter)] pt-24 pb-16 text-[var(--ground)] lg:pt-32 lg:pb-0">
          <Reveal className="grid gap-6 lg:grid-cols-12">
            <h2 id="todo" data-reveal className="text-[length:var(--t-h2)] leading-[1.02] lg:col-span-6">
              Todo tu trabajo, en un solo lugar.
            </h2>
            <p data-reveal style={d(1)} className="text-[length:var(--t-lead)] text-[var(--ground)]/85 lg:col-span-5 lg:col-start-8 lg:pt-3">
              Lo que hoy tenés repartido entre planillas, chats, mails y notas, ordenado por viajero y por viaje.
            </p>
          </Reveal>
          <div className="mt-14 lg:mt-0">
            <FeaturePin features={FEATURES} />
          </div>
        </section>

        {/* Lo que ven los viajeros: tres teléfonos con el portal. */}
        <section id="viajeros" aria-labelledby="viajeros-t" className="scroll-mt-24 overflow-hidden bg-[var(--mint)] px-[var(--gutter)] pt-24 lg:pt-32">
          <Reveal className="grid gap-12 lg:grid-cols-12 lg:items-end">
            <div className="pb-0 lg:col-span-4 lg:pb-32">
              <h2 id="viajeros-t" data-reveal className="text-[length:var(--t-h2)] leading-[1.02]">
                Lo que ven los viajeros
              </h2>
              <p data-reveal style={d(1)} className="mt-6 text-[length:var(--t-lead)]">
                Un portal con la marca de tu agencia: la cuenta regresiva, el plan de cada día y un chat directo con vos. Cada uno elige su personaje.
              </p>
            </div>
            <div className="flex items-end justify-center gap-4 sm:gap-6 lg:col-span-8">
              {[
                { src: "/landing/cel-05-portal-itinerario-dia.webp", alt: "El itinerario del día en Magic Kingdom en el portal", y: "translate-y-10" },
                { src: "/landing/cel-01-portal-inicio.webp", alt: "Inicio del portal con la cuenta regresiva del viaje", y: "" },
                { src: "/landing/cel-07b-portal-elegir-personaje.webp", alt: "Elegir el personaje de cada viajero en el portal", y: "translate-y-16 max-sm:hidden" },
              ].map((p, i) => (
                <div key={p.src} data-reveal style={d(i)} className={clsx("w-[44%] max-w-[300px] sm:w-[30%]", p.y)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.src} alt={p.alt} width={720} height={1558} loading="lazy" className="lift w-full rounded-t-[36px] border-[8px] border-b-0 border-[var(--night)] bg-[var(--night)]" />
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        {/* Precio: US$ 20 por mes, tachado, porque durante la beta es gratis. */}
        <Reveal>
          <section id="precio" aria-labelledby="precio-t" className="scroll-mt-24 px-[var(--gutter)] pt-24 lg:pt-32">
            <div className="grid gap-6 lg:grid-cols-12">
              <h2 id="precio-t" data-reveal className="text-[length:var(--t-h2)] leading-[1.02] lg:col-span-6">
                Un precio, todo incluido.
              </h2>
              <p data-reveal style={d(1)} className="text-[length:var(--t-lead)] lg:col-span-5 lg:col-start-8 lg:pt-3">
                Sin funciones bloqueadas. Y mientras Yiorno esté en beta, no pagás nada.
              </p>
            </div>
            <div data-reveal style={d(2)} className="mt-12 grid overflow-hidden rounded-[32px] bg-white lg:grid-cols-12">
              <div className="bg-[var(--night)] p-8 text-[var(--ground)] sm:p-10 lg:col-span-5">
                <p className="text-[length:var(--t-lead)] font-semibold">Por agente</p>
                <p className="mt-6 text-[var(--ground)]/60">
                  <s className="figure text-[clamp(40px,4vw,60px)] leading-none decoration-[var(--mint)] decoration-4">US$ 20/mes</s>
                </p>
                <p className="figure mt-3 text-[clamp(64px,7vw,104px)] leading-none text-[var(--mint)]">Gratis</p>
                <p className="mt-3 text-[length:var(--t-lead)]">mientras dure la beta; después, US$ 20 por mes por agente.</p>
                <Link
                  href="/registro"
                  className="press mt-10 inline-flex h-[52px] items-center rounded-[10px] bg-[var(--ground)] px-7 text-base font-semibold text-[var(--night)] hover:bg-white"
                >
                  Crear cuenta gratis
                </Link>
                <p className="mt-4 text-[15px] text-[var(--ground)]/70">Sin tarjeta. Te avisamos antes de que termine la beta.</p>
              </div>
              <div className="flex flex-col justify-center p-8 sm:p-10 lg:col-span-7 lg:px-14">
                <p className="text-[length:var(--t-lead)] font-semibold">Todo lo que incluye</p>
                <ul className="mt-7 grid gap-x-10 gap-y-5 sm:grid-cols-2">
                  {INCLUDED.map((item, i) => (
                    <li key={item} className={clsx("flex gap-3", i >= 4 && "max-sm:hidden")}>
                      <YiornoMonogram className="mt-1 h-5 shrink-0 text-brand-600" title={null} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                {/* En el teléfono, el resto de la lista queda plegado para no sumar otra pantalla. */}
                <details className="group mt-5 sm:hidden">
                  <summary className="press inline-flex cursor-pointer list-none items-center gap-2 rounded-[10px] py-2 font-semibold text-brand-700">
                    <span className="group-open:hidden">Ver todo lo que incluye</span>
                    <span className="hidden group-open:inline">Ver menos</span>
                  </summary>
                  <ul className="mt-3 grid gap-y-5">
                    {INCLUDED.slice(4).map((item) => (
                      <li key={item} className="flex gap-3">
                        <YiornoMonogram className="mt-1 h-5 shrink-0 text-brand-600" title={null} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            </div>
            {/* Las agencias con varios agentes arman su plan con nosotros. */}
            <p data-reveal style={d(3)} className="mt-6 text-[length:var(--t-lead)]">
              ¿Sos una agencia con varios agentes? Escribinos a{" "}
              <a
                href="mailto:info@yiorno.app?subject=Plan%20para%20mi%20agencia"
                className="font-semibold text-brand-700 underline decoration-2 underline-offset-4 hover:text-brand-600"
              >
                info@yiorno.app
              </a>{" "}
              y armamos un plan para tu equipo.
            </p>
          </section>
        </Reveal>

        {/* Preguntas: el título queda fijo mientras pasa la lista. */}
        <Reveal>
          <section id="preguntas" aria-labelledby="preguntas-t" className="scroll-mt-24 px-[var(--gutter)] py-24 lg:grid lg:grid-cols-12 lg:gap-8 lg:py-32">
            <h2 id="preguntas-t" data-reveal className="text-[length:var(--t-h2)] leading-[1.02] lg:sticky lg:top-28 lg:col-span-4 lg:self-start">
              Lo que nos preguntan
            </h2>
            <div className="mt-10 space-y-2 lg:col-span-8 lg:mt-0" data-reveal style={d(1)}>
              {FAQ.map((f) => (
                <details key={f.q} name="faq" className="group rounded-[16px] bg-white open:bg-brand-600 open:text-white">
                  <summary className="flex min-h-[76px] cursor-pointer list-none items-center justify-between gap-6 px-6 py-4 text-[20px] font-medium max-sm:text-[18px]">
                    {f.q}
                    <span aria-hidden className="relative size-4 shrink-0">
                      <span className="absolute top-1/2 left-0 h-[3px] w-4 -translate-y-1/2 rounded-full bg-current" />
                      <span className="plus-v absolute top-1/2 left-0 h-[3px] w-4 -translate-y-1/2 rotate-90 rounded-full bg-current group-open:rotate-0" />
                    </span>
                  </summary>
                  <p className="max-w-[56ch] px-6 pb-6">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        </Reveal>

        {/* El cierre: el primer paso del alta, ya abierto. */}
        <section aria-labelledby="empezar" className="relative mx-[var(--gutter)] grid gap-12 overflow-hidden rounded-[40px] bg-brand-600 px-[var(--gutter)] py-16 text-white lg:grid-cols-12 lg:items-center lg:py-24">
          <div className="relative lg:col-span-7">
            <h2 id="empezar" className="text-[length:var(--t-h2)] leading-[0.98] font-bold">
              <span className="block">Tus viajeros,</span>
              <span className="block">en orden.</span>
            </h2>
            <p className="mt-6 max-w-[44ch] text-[length:var(--t-lead)] text-white/90">Creás la cuenta, cargás tu primer viaje y Yiorno empieza a avisarte desde hoy.</p>
          </div>
          <div className="relative flex lg:col-span-5 lg:justify-end">
            <SignupDialog />
          </div>
        </section>
      </main>

      {/* El cierre de la página: el monograma grande, el eslogan y los vínculos (el logotipo ya está en la barra). */}
      <footer className="px-[var(--gutter)] pt-24 pb-10 lg:pt-32">
        <div className="flex flex-col gap-10 sm:flex-row sm:items-end sm:gap-14">
          <YiornoMonogram className="h-[180px] text-brand-600 sm:h-[240px] lg:h-[300px]" title="Yiorno" />
          <p className="max-w-[12ch] pb-2 text-[length:var(--t-h2)] leading-[1.02] font-bold tracking-[-0.03em]">Cada día del viaje, en orden.</p>
        </div>
        <div className="mt-14 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3 text-[15px] text-slate-600">
          <p>Yiorno · CRM para agentes de viaje</p>
          <nav className="flex flex-wrap gap-6 text-[var(--night)]">
            <Link href="/login" className="hover:text-brand-700">
              Ingresar
            </Link>
            <Link href="/registro" className="hover:text-brand-700">
              Crear cuenta
            </Link>
            <Link href="/portal/login" className="hover:text-brand-700">
              Portal del viajero
            </Link>
            <a href="mailto:info@yiorno.app" className="hover:text-brand-700">
              info@yiorno.app
            </a>
          </nav>
          <p>© {new Date().getFullYear()} Yiorno</p>
        </div>
      </footer>
    </div>
  );
}
