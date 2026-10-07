// Datos de ejemplo para desarrollo. Ejecutar con: npm run db:seed
// (corre con la condición "react-server" para poder reutilizar los módulos del servidor).
import "dotenv/config";
import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/password";
import { provisionOrganization } from "../src/lib/provision";
import { encrypt } from "../src/lib/crypto";
import type { Destination, ItemType, BookingStatus } from "../src/generated/prisma/enums";
import type { Prisma } from "../src/generated/prisma/client";

const DAY = 86_400_000;
const today = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()));
const d = (offset: number) => new Date(today.getTime() + offset * DAY);
const birth = (years: number, extraDays = 0) => new Date(today.getTime() - years * 365.25 * DAY - extraDays * DAY);

async function main() {
  if (await db.user.findUnique({ where: { email: "demo@crm.test" } })) {
    console.log("Los datos de ejemplo ya existen (demo@crm.test). Usá `npm run db:reset` para empezar de cero.");
    return;
  }

  const password = await hashPassword("demo1234");

  // Agencia en la plataforma: ve los números de sus agentes, sin poder editar nada.
  const madre = await db.agency.create({
    data: {
      name: "Agencia Madre Travel",
      contactName: "Sofía Paz",
      contactEmail: "comisiones@agenciamadre.test",
      defaultCommissionRate: 10,
      notes: "Liquidamos a mes vencido, después del viaje.",
      inviteCode: "MADRE",
      users: { create: { name: "Sofía Paz", email: "agencia@crm.test", passwordHash: password, role: "AGENCY" } },
    },
  });

  // Cada agente tiene su propio negocio y sus datos son solo suyos.
  async function agent(opts: { user: { name: string; email: string; isPlatformAdmin?: boolean }; org: Omit<Prisma.OrganizationCreateInput, "users"> }) {
    const org = await db.organization.create({
      data: { ...opts.org, users: { create: { ...opts.user, passwordHash: password, role: "AGENT" } } },
      include: { users: true },
    });
    await provisionOrganization(org.id);
    return { org, user: org.users[0] };
  }
  const { org, user: laura } = await agent({
    user: { name: "Laura Gómez", email: "demo@crm.test", isPlatformAdmin: true },
    org: {
      name: "Viajes Encantados",
      marketingCode: "ENCANTADOS",
      tagline: "Disney, Universal y cruceros planificados hasta el último detalle mágico.",
      bio: "Hace 10 años que ayudo a familias de toda Latinoamérica a vivir Disney y Universal sin estrés.",
      contactEmail: "hola@viajesencantados.test",
      contactPhone: "+54 9 11 5555-0000",
      defaultCommissionRate: 10,
      agency: { connect: { id: madre.id } },
      agencyJoinedAt: d(-400),
    },
  });
  const { org: martinOrg, user: martin } = await agent({
    user: { name: "Martín Ruiz", email: "martin@crm.test" },
    org: {
      name: "Martín Ruiz Viajes",
      marketingCode: "MARTINRUIZ",
      contactEmail: "martin@martinruizviajes.test",
      defaultCommissionRate: 10,
      agency: { connect: { id: madre.id } },
      agencyJoinedAt: d(-200),
    },
  });
  // Agente independiente: carga su agencia solo para armar las planillas y cobrar.
  const { org: paulaOrg, user: paula } = await agent({
    user: { name: "Paula Díaz", email: "paula@crm.test" },
    org: {
      name: "Paula Díaz Travel",
      marketingCode: "PAULADIAZ",
      contactEmail: "paula@pauladiaztravel.test",
      defaultCommissionRate: 10,
      agency: { create: { name: "Operador Mágico", contactEmail: "pagos@operadormagico.test", defaultCommissionRate: 12 } },
    },
  });
  const orgOf = (userId: string) => (userId === martin.id ? martinOrg : userId === paula.id ? paulaOrg : org);

  // ── Clientes ──
  type TravelerSeed = { firstName: string; lastName?: string; age: number; heightCm?: number; relationship: string; dietaryNotes?: string; passportExpiry?: Date };
  type ClientSeed = {
    firstName: string; lastName: string; email: string; phone: string; city: string; tags: string[];
    pace?: "RELAXED" | "MODERATE" | "INTENSE"; budgetLevel?: "VALUE" | "MODERATE" | "DELUXE" | "LUXURY";
    interests: string[]; previousVisits?: string; dietaryNotes?: string; ownerId: string; inviteCode: string;
    travelers: TravelerSeed[];
  };
  const clientSeeds: ClientSeed[] = [
    {
      firstName: "Amanda", lastName: "Reyes", email: "cliente@crm.test", phone: "+54 9 11 4444-1111", city: "Buenos Aires",
      tags: ["VIP", "Repite"], pace: "MODERATE", budgetLevel: "DELUXE", interests: ["Personajes", "Princesas", "Fuegos artificiales", "Gastronomía"],
      previousVisits: "Disney World 2023 (Magic Kingdom y EPCOT)", ownerId: laura.id, inviteCode: "AMANDA",
      travelers: [
        { firstName: "Amanda", age: 38, relationship: "Titular" },
        { firstName: "Diego", lastName: "Reyes", age: 40, relationship: "Pareja" },
        { firstName: "Mía", lastName: "Reyes", age: 7, heightCm: 118, relationship: "Hija" },
        { firstName: "Tomás", lastName: "Reyes", age: 4, heightCm: 101, relationship: "Hijo", dietaryNotes: "Alergia al maní" },
      ],
    },
    {
      firstName: "Familia", lastName: "Whitmore", email: "whitmore@example.test", phone: "+52 55 1234 5678", city: "Ciudad de México",
      tags: ["Grupo", "Primera vez"], pace: "INTENSE", budgetLevel: "MODERATE", interests: ["Atracciones intensas", "Harry Potter", "Marvel", "Nintendo"],
      ownerId: martin.id, inviteCode: "WHITMO",
      travelers: [
        { firstName: "Carlos", lastName: "Whitmore", age: 45, relationship: "Titular", passportExpiry: d(200) },
        { firstName: "Elena", lastName: "Whitmore", age: 43, relationship: "Pareja" },
        { firstName: "Lucas", lastName: "Whitmore", age: 14, heightCm: 165, relationship: "Hijo" },
        { firstName: "Valen", lastName: "Whitmore", age: 11, heightCm: 142, relationship: "Hija" },
      ],
    },
    {
      firstName: "Priya", lastName: "Raman", email: "priya@example.test", phone: "+56 9 8765 4321", city: "Santiago",
      tags: ["Luna de miel"], pace: "RELAXED", budgetLevel: "LUXURY", interests: ["Gastronomía", "Shows y desfiles", "Pileta y descanso"],
      dietaryNotes: "Vegetarianos", ownerId: laura.id, inviteCode: "PRIYAR",
      travelers: [
        { firstName: "Priya", lastName: "Raman", age: 29, relationship: "Titular", dietaryNotes: "Vegetariana" },
        { firstName: "Nico", lastName: "Fernández", age: 31, relationship: "Pareja", dietaryNotes: "Vegetariano" },
      ],
    },
    {
      firstName: "Linh", lastName: "Nguyen", email: "linh@example.test", phone: "+54 9 351 555-2222", city: "Córdoba",
      tags: ["Crucero"], pace: "MODERATE", budgetLevel: "DELUXE", interests: ["Star Wars", "Pixar", "Personajes"],
      ownerId: laura.id, inviteCode: "LINHNG",
      travelers: [
        { firstName: "Linh", lastName: "Nguyen", age: 41, relationship: "Titular" },
        { firstName: "Bao", lastName: "Nguyen", age: 9, heightCm: 130, relationship: "Hijo" },
      ],
    },
    {
      firstName: "Theo", lastName: "Brennan", email: "theo@example.test", phone: "+598 99 123 456", city: "Montevideo",
      tags: ["VIP"], pace: "INTENSE", budgetLevel: "DELUXE", interests: ["Atracciones intensas", "Star Wars"],
      ownerId: martin.id, inviteCode: "THEOBR",
      travelers: [{ firstName: "Theo", lastName: "Brennan", age: 35, relationship: "Titular" }],
    },
    {
      firstName: "Nadia", lastName: "Petrov", email: "nadia@example.test", phone: "+54 9 261 555-3333", city: "Mendoza",
      tags: [], interests: [], ownerId: laura.id, inviteCode: "NADIAP",
      travelers: [{ firstName: "Nadia", lastName: "Petrov", age: 33, relationship: "Titular" }],
    },
    {
      firstName: "Familia", lastName: "Ortiz", email: "ortiz@example.test", phone: "+57 300 555 1234", city: "Bogotá",
      tags: ["Crucero"], pace: "MODERATE", budgetLevel: "MODERATE", interests: ["Personajes", "Pileta y descanso"],
      ownerId: paula.id, inviteCode: "ORTIZF",
      travelers: [
        { firstName: "Andrés", lastName: "Ortiz", age: 42, relationship: "Titular" },
        { firstName: "Camila", lastName: "Ortiz", age: 39, relationship: "Pareja" },
        { firstName: "Sara", lastName: "Ortiz", age: 8, heightCm: 125, relationship: "Hija" },
      ],
    },
  ];

  const clients: Prisma.ClientGetPayload<{ include: { travelers: true } }>[] = [];
  for (const c of clientSeeds) {
    const { travelers, ...data } = c;
    clients.push(
      await db.client.create({
        data: {
          organizationId: orgOf(data.ownerId).id,
          ...data,
          travelers: {
            create: travelers.map((t) => ({
              firstName: t.firstName,
              lastName: t.lastName ?? c.lastName,
              birthDate: birth(t.age, 40),
              heightCm: t.heightCm,
              relationship: t.relationship,
              dietaryNotes: t.dietaryNotes,
              passportExpiry: t.passportExpiry,
            })),
          },
        },
        include: { travelers: true },
      }),
    );
  }
  const [amanda, whitmore, priya, linh, theo, nadia, ortiz] = clients;

  await db.clientAccount.create({ data: { clientId: amanda.id, email: amanda.email!, passwordHash: password } });
  await db.supplierLogin.create({
    data: { clientId: amanda.id, supplier: "MyDisney", username: "amanda.reyes@example.test", passwordEncrypted: encrypt("contraseña-de-ejemplo") },
  });

  // ── Reservas ──
  const seqs = new Map<string, number>();
  type ItemSeed = {
    type: ItemType;
    description: string;
    supplier: string;
    price: number;
    rate?: number;
    confirmation?: string;
    status?: "PENDING" | "CONFIRMED" | "CANCELLED";
    start?: number; // días desde hoy (por defecto, las fechas del viaje)
    nights?: number;
    sale?: number; // fecha de venta (por defecto, la del viaje)
    deposit?: number;
    depositPaid?: number;
    balanceDue?: number;
    balancePaid?: number;
    commission?: "PENDING" | "REQUESTED" | "PAID";
    notes?: string;
  };
  async function booking(opts: {
    client: (typeof clients)[number];
    agentId: string;
    title: string;
    destination: Destination;
    status: BookingStatus;
    start?: number;
    nights?: number;
    finalPaymentDue?: number; // vencimiento del saldo de la primera reserva
    saleDate?: number;
    commissionStatus?: "PENDING" | "REQUESTED" | "PAID";
    items: ItemSeed[];
  }) {
    const organizationId = opts.client.organizationId;
    const seq = (seqs.get(organizationId) ?? 0) + 1;
    seqs.set(organizationId, seq);
    const rate = organizationId === paulaOrg.id ? 12 : 10;
    const sold = ["BOOKED", "PAID_IN_FULL", "TRAVELED", "COMPLETED"].includes(opts.status);
    const paidInFull = ["PAID_IN_FULL", "TRAVELED", "COMPLETED"].includes(opts.status);
    const startDate = opts.start !== undefined ? d(opts.start) : null;
    const endDate = startDate && opts.nights ? d(opts.start! + opts.nights) : null;
    const children = opts.client.travelers.filter((t) => t.birthDate && today.getTime() - t.birthDate.getTime() < 18 * 365.25 * DAY).length;
    const items = opts.items.map((i, idx) => {
      const status = i.status ?? (opts.status === "CANCELLED" ? "CANCELLED" : sold ? "CONFIRMED" : "PENDING");
      const commissionAmount = Math.round(i.price * (i.rate ?? rate)) / 100;
      const balanceDue = i.balanceDue ?? (idx === 0 ? opts.finalPaymentDue : undefined);
      const commission = status === "CONFIRMED" ? (i.commission ?? opts.commissionStatus ?? "PENDING") : "PENDING";
      return {
        type: i.type,
        status,
        description: i.description,
        supplier: i.supplier,
        confirmationNumber: i.confirmation,
        notes: i.notes,
        startDate: i.start !== undefined ? d(i.start) : startDate,
        endDate: i.start !== undefined && i.nights ? d(i.start + i.nights) : endDate,
        position: idx,
        price: i.price,
        depositAmount: i.deposit ?? (idx === 0 && sold ? Math.round(i.price * 0.2) : null),
        depositPaidAt: i.depositPaid !== undefined ? d(i.depositPaid) : idx === 0 && sold && opts.saleDate !== undefined ? d(opts.saleDate) : null,
        balanceDue: balanceDue !== undefined ? d(balanceDue) : null,
        balancePaidAt: i.balancePaid !== undefined ? d(i.balancePaid) : paidInFull && balanceDue !== undefined ? d(balanceDue - 3) : null,
        saleDate: status !== "CONFIRMED" ? null : i.sale !== undefined ? d(i.sale) : opts.saleDate !== undefined ? d(opts.saleDate) : null,
        commissionRate: i.rate ?? null,
        commissionAmount,
        commissionStatus: commission,
        commissionPaidAt: commission === "PAID" ? d(-5) : null,
        commissionPaidAmount: commission === "PAID" ? commissionAmount : null,
      } as const;
    });
    const active = items.filter((i) => i.status !== "CANCELLED");
    return db.booking.create({
      data: {
        organizationId,
        code: `R-${String(seq).padStart(4, "0")}`,
        clientId: opts.client.id,
        agentId: opts.agentId,
        title: opts.title,
        destination: opts.destination,
        status: opts.status,
        startDate,
        endDate,
        adults: opts.client.travelers.length - children,
        children,
        totalPrice: active.reduce((t, i) => t + i.price, 0),
        commissionAmount: Math.round(active.reduce((t, i) => t + i.commissionAmount, 0) * 100) / 100,
        travelers: { create: opts.client.travelers.map((t) => ({ travelerId: t.id })) },
        items: { create: items },
      },
    });
  }

  // El viaje de los Reyes muestra el caso típico: un viaje con varias reservas, cada una con su
  // proveedor, su forma de pago y su comisión.
  const amandaTrip = await booking({
    client: amanda, agentId: laura.id, title: "Disney + Universal — familia Reyes", destination: "COMBINED",
    status: "BOOKED", start: 55, nights: 7,
    items: [
      {
        type: "PACKAGE", description: "Paquete Art of Animation, suite familiar, 5 noches + tickets Disney 4 días", supplier: "Disney Destinations",
        price: 6200, confirmation: "DDX-48211", start: 55, nights: 5, sale: -40, deposit: 200, depositPaid: -40, balanceDue: 25,
        notes: "Incluye Lightning Lane Multi Pass para los 4 días de parque.",
      },
      {
        type: "TICKETS", description: "Tickets Universal 2 días, 2 parques (x4)", supplier: "Universal Orlando",
        price: 1480, confirmation: "UOR-31877", start: 60, nights: 1, sale: -20, balancePaid: -20,
        notes: "Pagados completos al reservar.",
      },
      {
        type: "CAR", description: "Auto SUV 8 días", supplier: "Alamo", price: 620, rate: 8, confirmation: "ALM-7781",
        start: 55, nights: 7, sale: -10, balanceDue: 55, notes: "Retiro y devolución en el aeropuerto de Orlando (MCO). Se paga en el mostrador.",
      },
      {
        type: "HOTEL", description: "Hotel en Downtown Orlando, 2 noches", supplier: "Booking", price: 380, rate: 8,
        status: "PENDING", start: 60, nights: 2, notes: "Para los días de Universal. Falta confirmar.",
      },
      { type: "INSURANCE", description: "Seguro de viaje familiar", supplier: "Aseguradora", price: 280, rate: 20, start: 55, nights: 7, sale: -40, balancePaid: -40 },
    ],
  });

  await booking({
    client: amanda, agentId: laura.id, title: "Disney Cruise — familia Reyes", destination: "DISNEY_CRUISE",
    status: "QUOTED", start: 240, nights: 4, items: [],
  });
  const whitmoreTrip = await booking({
    client: whitmore, agentId: martin.id, title: "Universal Orlando — Whitmore", destination: "UNIVERSAL_ORLANDO",
    status: "PAID_IN_FULL", start: 12, nights: 6,
    finalPaymentDue: -20, saleDate: -90,
    items: [
      { type: "HOTEL", description: "Cabana Bay, habitación familiar, 6 noches", supplier: "Universal Orlando", price: 2100, confirmation: "UOR-55120" },
      { type: "TICKETS", description: "Entradas 4 días, 3 parques (x4)", supplier: "Universal Orlando", price: 2480 },
      { type: "EXPERIENCE", description: "Express Pass", supplier: "Universal Orlando", price: 760 },
    ],
  });
  await booking({
    client: priya, agentId: laura.id, title: "Luna de miel en Disney World", destination: "DISNEY_WORLD",
    status: "COMPLETED", start: -60, nights: 6, saleDate: -200, finalPaymentDue: -90,
    commissionStatus: "PAID",
    items: [{ type: "PACKAGE", description: "Grand Floridian 6 noches + entradas", supplier: "Disney Destinations", price: 9800 }],
  });
  await booking({
    client: linh, agentId: laura.id, title: "Disney Cruise — Nguyen", destination: "DISNEY_CRUISE",
    status: "TRAVELED", start: -15, nights: 5, saleDate: -150, finalPaymentDue: -100,
    items: [{ type: "CRUISE", description: "Disney Wish 5 noches, camarote con balcón", supplier: "Disney Cruise Line", price: 6200, confirmation: "DCL-90311" }],
  });
  await booking({
    client: theo, agentId: martin.id, title: "Disney + Universal — Theo", destination: "COMBINED",
    status: "TRAVELED", start: -35, nights: 8, saleDate: -120, finalPaymentDue: -80, commissionStatus: "REQUESTED",
    items: [
      { type: "HOTEL", description: "Hotel en Disney Springs, 4 noches", supplier: "Booking", price: 1300, rate: 8 },
      { type: "TICKETS", description: "Entradas Disney 4 días", supplier: "Disney", price: 690 },
      { type: "TICKETS", description: "Entradas Universal 3 días", supplier: "Universal Orlando", price: 520 },
    ],
  });
  await booking({
    client: nadia, agentId: laura.id, title: "Consulta Disneyland París", destination: "DISNEYLAND_PARIS",
    status: "INQUIRY", start: 150, nights: 4, items: [],
  });
  await booking({
    client: ortiz, agentId: paula.id, title: "Crucero Disney — familia Ortiz", destination: "DISNEY_CRUISE",
    status: "TRAVELED", start: -25, nights: 4, saleDate: -130, finalPaymentDue: -90,
    items: [{ type: "CRUISE", description: "Disney Dream 4 noches, camarote exterior", supplier: "Disney Cruise Line", price: 4100, confirmation: "DCL-77120" }],
  });
  await booking({
    client: ortiz, agentId: paula.id, title: "Disney World 2027 — familia Ortiz", destination: "DISNEY_WORLD",
    status: "QUOTED", start: 280, nights: 6, items: [],
  });

  for (const [organizationId, bookingSeq] of seqs) await db.organization.update({ where: { id: organizationId }, data: { bookingSeq } });

  // Cotización con dos opciones para el crucero de Amanda.
  const cruise = await db.booking.findFirstOrThrow({ where: { organizationId: org.id, title: "Disney Cruise — familia Reyes" } });
  await db.quote.create({
    data: {
      bookingId: cruise.id,
      title: "Crucero Disney de 4 noches",
      message: "Te armé dos alternativas para el crucero: una con camarote interior y otra con balcón. Las dos incluyen el día en Castaway Cay.",
      status: "SENT",
      sentAt: d(-2),
      validUntil: d(12),
      options: {
        create: [
          { name: "Camarote interior", position: 0, items: { create: [{ type: "CRUISE", description: "Disney Wish 4 noches, interior", supplier: "Disney Cruise Line", price: 4300 }] } },
          { name: "Camarote con balcón", position: 1, items: { create: [{ type: "CRUISE", description: "Disney Wish 4 noches, verandah", supplier: "Disney Cruise Line", price: 5600 }] } },
        ],
      },
    },
  });

  // Itinerario de ejemplo para el viaje de Amanda (primeros días).
  const days = [
    { title: "Llegada", items: [{ type: "TRAVEL", title: "Vuelo y traslado al hotel", startTime: "14:00" }, { type: "POOL", title: "Tarde de pileta en el resort", startTime: "17:00" }] },
    { title: "Magic Kingdom", items: [{ type: "PARK", title: "Magic Kingdom", startTime: "08:30" }, { type: "CHARACTER", title: "Encuentro con princesas", startTime: "10:30", location: "Fantasyland" }, { type: "SHOW", title: "Fuegos artificiales", startTime: "21:00" }] },
    { title: "EPCOT", items: [{ type: "PARK", title: "EPCOT", startTime: "09:00" }, { type: "DINING", title: "Almuerzo", startTime: "12:30", location: "World Showcase" }] },
  ] as const;
  for (const [i, day] of days.entries()) {
    await db.itineraryDay.create({
      data: {
        bookingId: amandaTrip.id,
        dayNumber: i + 1,
        date: d(55 + i),
        title: day.title,
        items: { create: day.items.map((it, pos) => ({ ...it, position: pos })) },
      },
    });
  }
  await db.diningReservation.create({
    data: { bookingId: amandaTrip.id, restaurant: "Cinderella's Royal Table", dateTime: new Date(`${d(56).toISOString().slice(0, 10)}T11:45:00.000Z`), partySize: 4, confirmationNumber: "ADR-1234" },
  });

  // Mensajes, tareas, grupo.
  await db.message.createMany({
    data: [
      { clientId: amanda.id, bookingId: amandaTrip.id, senderType: "AGENT", senderUserId: laura.id, body: "¡Hola Amanda! Ya está todo reservado. En unos días te paso el itinerario completo.", createdAt: d(-3), readByClientAt: d(-3) },
      { clientId: amanda.id, bookingId: amandaTrip.id, senderType: "CLIENT", body: "¡Genial! ¿Podemos sumar un desayuno con personajes? Mía está obsesionada con las princesas 😍", createdAt: d(-1) },
    ],
  });
  await db.task.createMany({
    data: [
      { organizationId: org.id, assigneeId: laura.id, bookingId: amandaTrip.id, clientId: amanda.id, title: "Buscar desayuno con personajes para los Reyes", dueDate: d(1), priority: "HIGH" },
      { organizationId: martinOrg.id, assigneeId: martin.id, bookingId: whitmoreTrip.id, clientId: whitmore.id, title: "Enviar documentos finales a los Whitmore", dueDate: d(3), priority: "MEDIUM" },
      { organizationId: org.id, assigneeId: laura.id, clientId: nadia.id, title: "Llamar a Nadia para entender qué busca en París", dueDate: d(0), priority: "MEDIUM" },
    ],
  });
  await db.group.create({
    data: {
      organizationId: martinOrg.id,
      name: "Reunión familiar Whitmore — 2027",
      description: "Tres familias viajando juntas a Universal.",
      destination: "UNIVERSAL_ORLANDO",
      startDate: d(130),
      endDate: d(137),
      organizerId: whitmore.id,
    },
  });

  // Novedades de EJEMPLO (reemplazar por información real y verificada).
  await db.knowledgeItem.createMany({
    data: [
      {
        title: "EJEMPLO — Cómo cargar novedades",
        content: "Este es un contenido de ejemplo. Cargá acá aperturas, cierres, remodelaciones, eventos de temporada, promociones y cambios de reglas, con sus fechas de vigencia. La IA prioriza esta información sobre lo que sabe de antes al armar itinerarios.",
        category: "TIP",
        destinations: [],
        tags: ["ejemplo"],
      },
      {
        title: "EJEMPLO — Remodelación de una atracción",
        content: "Ejemplo de formato: 'La atracción X de Magic Kingdom permanece cerrada por remodelación desde el 1/11 hasta el 15/12. Sugerir alternativas similares en Fantasyland.' Borrá este ejemplo y cargá datos reales.",
        category: "REFURBISHMENT",
        destinations: ["DISNEY_WORLD"],
        park: "Magic Kingdom",
        validFrom: d(-10),
        validTo: d(70),
        tags: ["ejemplo"],
      },
    ],
  });
  await db.knowledgeItem.create({
    data: {
      organizationId: org.id,
      title: "EJEMPLO — Tip interno",
      content: "Ejemplo de novedad privada (solo la ves vos): 'A las familias con chicos menores de 5 años les recomendamos volver al hotel a dormir la siesta los días de parque.'",
      category: "TIP",
      destinations: ["DISNEY_WORLD", "UNIVERSAL_ORLANDO"],
      tags: ["familias", "ejemplo"],
    },
  });

  console.log(`
Datos de ejemplo creados.
  Agentes de Agencia Madre Travel:  demo@crm.test · martin@crm.test
  Agente independiente:             paula@crm.test
  Panel de la agencia:              agencia@crm.test (código de invitación MADRE)
  Portal del viajero:               cliente@crm.test
  Contraseña de todos: demo1234
  Formulario público: /cotizar/ENCANTADOS
`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
