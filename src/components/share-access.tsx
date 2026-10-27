"use client";

import { useState, useTransition } from "react";
import { Check, Copy, RefreshCw, Share2 } from "lucide-react";
import { ActionForm, SubmitButton, type ActionState } from "@/components/form-controls";
import { buttonClass } from "@/components/ui";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/shadcn/dialog";

function CopyButton({ text, label, primary = false }: { text: string; label: string; primary?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className={buttonClass(primary ? "primary" : "secondary")}
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      {copied ? "¡Copiado!" : label}
    </button>
  );
}

/**
 * Compartir el portal con el cliente desde el viaje: lo mismo que la tarjeta "Portal del viajero" de la
 * ficha del cliente (código, link, generar otro, invitación por email) o, si ya tiene cuenta, el link al
 * viaje en su portal.
 */
export function ShareAccessButton({
  firstName,
  email,
  inviteCode,
  registerUrl,
  tripUrl,
  account,
  regenerate,
  sendInvite,
}: {
  firstName: string;
  email: string | null;
  inviteCode: string;
  registerUrl: string;
  tripUrl: string;
  account: { since: string; lastLogin: string | null } | null;
  regenerate: () => Promise<void>;
  sendInvite: (state: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [open, setOpen] = useState(false);
  const [regenerating, startRegenerate] = useTransition();
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Compartir el portal con el cliente"
        aria-label="Compartir el portal con el cliente"
        className="grid size-10 shrink-0 place-items-center rounded-full border border-[var(--border)] bg-white text-slate-700 hover:bg-[var(--raised)] hover:text-slate-900"
      >
        <Share2 className="size-4" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Compartir el portal con {firstName}</DialogTitle>
            <DialogDescription>
              {account
                ? `${firstName} ya tiene su cuenta: ve este viaje, el itinerario y los documentos.`
                : "Con el código o el link crea su cuenta y ve el viaje, el itinerario y los documentos."}
            </DialogDescription>
          </DialogHeader>

          {account ? (
            <div className="space-y-4">
              <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Activo desde {account.since}
                {account.lastLogin && <span className="block text-xs text-emerald-700">Último ingreso: {account.lastLogin}</span>}
              </p>
              <div className="flex flex-wrap gap-2">
                <CopyButton text={tripUrl} label="Copiar link del viaje" primary />
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-2xl bg-[var(--raised)] px-4 py-5 text-center">
                <p className="text-[12px] font-semibold tracking-[0.06em] text-[var(--ink-soft)] uppercase">Código de invitación</p>
                <p className="mt-1 font-mono text-3xl font-semibold tracking-widest text-brand-700">{inviteCode}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <CopyButton text={registerUrl} label="Copiar link" primary />
                <button
                  type="button"
                  disabled={regenerating}
                  onClick={() => startRegenerate(() => regenerate())}
                  className={buttonClass("ghost")}
                >
                  <RefreshCw className={regenerating ? "size-4 animate-spin" : "size-4"} /> Generar otro código
                </button>
              </div>
              <ActionForm action={sendInvite} className="border-t border-[var(--rule)] pt-4">
                <SubmitButton variant="secondary" disabled={!email} pendingText="Enviando…">
                  Enviar invitación por email
                </SubmitButton>
                <p className="mt-1.5 text-xs text-[var(--ink-soft)]">{email ? `Se la mandamos a ${email}.` : "El cliente no tiene email cargado."}</p>
              </ActionForm>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
