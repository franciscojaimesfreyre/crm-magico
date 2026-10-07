import { Plane } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/form-controls";
import { Card, CardHeader } from "@/components/ui";
import { formatDate, toDateInput } from "@/lib/format";
import { describeFlightLegs } from "@/lib/trips";
import { saveTripFlights } from "../actions";
import { FlightLegInputs, type FlightLegValues } from "./reservation-extras";
import type { LoadedBooking } from "./data";

/** Vuelos de ida y vuelta del viaje: dato de referencia (los agentes no los venden), opcional. */
export function TripFlights({ booking: b }: { booking: LoadedBooking }) {
  const values = (direction: "OUTBOUND" | "RETURN"): FlightLegValues | undefined => {
    const l = b.flightLegs.find((x) => x.direction === direction);
    return l ? { date: toDateInput(l.date), time: l.time ?? "", airline: l.airline ?? "", flightNumber: l.flightNumber ?? "" } : undefined;
  };
  const legs = describeFlightLegs(b.flightLegs, formatDate);
  const form = (
    <ActionForm action={saveTripFlights.bind(null, b.id)} className="space-y-4">
      <FlightLegInputs prefix="out" title="Ida" values={values("OUTBOUND")} />
      <FlightLegInputs prefix="back" title="Vuelta" values={values("RETURN")} />
      <SubmitButton size="sm">Guardar vuelos</SubmitButton>
    </ActionForm>
  );

  return (
    <Card>
      <CardHeader title="Vuelos" description="Opcional. Para tenerlos a mano: el cliente también los ve en su portal." />
      {legs.length === 0 ? (
        <div className="p-5">{form}</div>
      ) : (
        <>
          <ul className="divide-y divide-slate-100">
            {legs.map((l) => (
              <li key={l.direction} className="flex items-center gap-3 px-5 py-3 text-sm">
                <Plane className={l.direction === "RETURN" ? "size-4 -scale-x-100 text-sky-600" : "size-4 text-sky-600"} />
                <span className="w-14 font-medium text-slate-700">{l.label}</span>
                <span className="text-slate-800">{l.when || "Sin fecha"}</span>
                {l.flight && <span className="text-slate-500">· {l.flight}</span>}
              </li>
            ))}
          </ul>
          <details className="border-t border-slate-100 px-5 py-3">
            <summary className="cursor-pointer list-none text-xs font-medium text-brand-700">Editar vuelos</summary>
            <div className="pt-3">{form}</div>
          </details>
        </>
      )}
    </Card>
  );
}
