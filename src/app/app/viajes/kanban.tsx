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
import { BOOKING_STATUS_LABEL, DESTINATION_LABEL, PIPELINE } from "@/lib/labels";
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
      className={clsx("flex w-64 shrink-0 flex-col rounded-xl bg-slate-100 p-2 transition-colors", isOver && "bg-brand-100")}
    >
      <div className="mb-2 px-1">
        <p className="flex items-center justify-between text-sm font-semibold text-slate-800">
          {BOOKING_STATUS_LABEL[status]}
          <span className="rounded-full bg-white px-2 text-xs font-medium text-slate-600">{count}</span>
        </p>
        <p className="text-xs text-slate-500">{sum}</p>
      </div>
      <div className="flex min-h-24 flex-col gap-2">
        {cards.map((c) => (
          <Card key={c.id} card={c} />
        ))}
      </div>
    </div>
  );
}

function Card({ card }: { card: KanbanCard }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={clsx(
        "cursor-grab rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-xs active:cursor-grabbing",
        isDragging && "z-10 shadow-lg ring-2 ring-brand-300",
      )}
    >
      <Link href={`/app/viajes/${card.id}`} className="font-medium text-slate-900 hover:text-brand-700" onPointerDown={(e) => e.stopPropagation()}>
        {card.clientName}
      </Link>
      <p className="truncate text-xs text-slate-500">{card.title}</p>
      <p className="mt-1 text-xs text-slate-500">{DESTINATION_LABEL[card.destination]}</p>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-slate-500">{card.dates}</span>
        <span className="font-medium text-slate-800">{card.totalLabel}</span>
      </div>
    </div>
  );
}
