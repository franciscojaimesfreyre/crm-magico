"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import clsx from "clsx";
import { Avatar } from "@/components/ui";
import { BOOKING_STATUS_COLOR, BOOKING_STATUS_LABEL, DESTINATION_LABEL, DESTINATION_TONE, PIPELINE } from "@/lib/labels";
import type { BookingStatus, Destination } from "@/generated/prisma/enums";
import { setBookingStatus } from "./actions";

export type KanbanCard = {
  id: string;
  code: string;
  title: string;
  clientName: string;
  destination: Destination;
  status: BookingStatus;
  dates: string;
  total: number;
  totalLabel: string;
  /** Días hasta la salida (null sin fecha; negativo si ya viajó). */
  daysToGo: number | null;
};

export function Kanban({ cards: initial, currency }: { cards: KanbanCard[]; currency: string }) {
  const [cards, setCards] = useState(initial);
  const [, start] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function onDragEnd(e: DragEndEvent) {
    const status = e.over?.id as BookingStatus | undefined;
    const id = String(e.active.id);
    const card = cards.find((c) => c.id === id);
    if (!status || !card || card.status === status) return;
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
    start(() => setBookingStatus(id, status));
  }

  const fmt = new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 0 });

  return (
    <DndContext id="kanban" sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {PIPELINE.map((status) => {
          const column = cards.filter((c) => c.status === status);
          const sum = column.reduce((s, c) => s + c.total, 0);
          return <Column key={status} status={status} count={column.length} sum={fmt.format(sum)} cards={column} />;
        })}
      </div>
    </DndContext>
  );
}

function Column({ status, count, sum, cards }: { status: BookingStatus; count: number; sum: string; cards: KanbanCard[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={clsx("flex w-72 shrink-0 flex-col rounded-[14px] p-2.5 transition-colors", isOver ? "bg-brand-100" : "bg-[var(--raised)]")}
      style={{ "--ticket-cut": isOver ? "var(--color-brand-100)" : "var(--raised)" } as React.CSSProperties}
    >
      <div className="mb-3 px-1.5 pt-1">
        <p className="flex items-baseline justify-between gap-2">
          <span className={clsx("rounded-full px-2.5 py-0.5 text-[13px] font-bold", BOOKING_STATUS_COLOR[status])}>{BOOKING_STATUS_LABEL[status]}</span>
          <span className="text-sm text-[var(--ink-soft)] tabular-nums">{count}</span>
        </p>
        <p className="text-xs text-[var(--ink-soft)] tabular-nums">{sum}</p>
      </div>
      <div className="flex min-h-24 flex-col gap-2.5">
        {cards.map((c) => (
          <Card key={c.id} card={c} />
        ))}
      </div>
    </div>
  );
}

/** Cada viaje del tablero es un ticket chico: el talón con los días que faltan, el cuerpo con el cliente. */
function Card({ card }: { card: KanbanCard }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id });
  const days = card.daysToGo;
  const tone = DESTINATION_TONE[card.destination];
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={clsx("ticket cursor-grab text-sm active:cursor-grabbing", isDragging && "z-10 shadow-lg ring-2 ring-brand-300")}
    >
      <div className={clsx("ticket-stub flex w-16 flex-col items-center justify-center rounded-l-[19px] px-1 py-3 text-center", tone.soft, tone.ink)}>
        {days !== null && days > 0 ? (
          <>
            <span className="figure text-2xl leading-none">{days}</span>
            <span className="mt-0.5 text-[11px] font-medium">{days === 1 ? "día" : "días"}</span>
          </>
        ) : (
          <span className="text-xs leading-tight font-medium">{days === null ? "Sin fecha" : days === 0 ? "Hoy" : "Viajó"}</span>
        )}
      </div>
      <div className="min-w-0 px-3 py-2.5">
        <Link href={`/app/viajes/${card.id}`} className="flex items-center gap-1.5 font-medium text-slate-900 hover:text-brand-700" onPointerDown={(e) => e.stopPropagation()}>
          <Avatar name={card.clientName} className="size-5 text-[10px]" />
          <span className="truncate">{card.clientName}</span>
        </Link>
        <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-[var(--ink-soft)]">
          <span className={clsx("size-2 shrink-0 rounded-full", tone.dot)} />
          {DESTINATION_LABEL[card.destination]}
        </p>
        <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
          <span className="truncate text-[var(--ink-soft)]">{card.dates}</span>
          <span className="shrink-0 font-medium text-slate-800 tabular-nums">{card.totalLabel}</span>
        </div>
      </div>
    </div>
  );
}
