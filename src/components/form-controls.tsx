"use client";

import { useActionState, useEffect, useRef, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Alert, buttonClass } from "@/components/ui";

export type ActionState = { error?: string; ok?: string } | undefined;

/** Botón de envío que se deshabilita mientras la acción corre. */
export function SubmitButton({
  children,
  pendingText,
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & {
  pendingText?: string;
  variant?: Parameters<typeof buttonClass>[0];
  size?: Parameters<typeof buttonClass>[1];
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || props.disabled} className={buttonClass(variant, size, className)} {...props}>
      {pending ? (pendingText ?? "Guardando…") : children}
    </button>
  );
}

/** Botón que pide confirmación antes de enviar el formulario que lo contiene. */
export function ConfirmButton({
  message,
  children,
  variant = "danger",
  size = "sm",
  className,
  ...props
}: ComponentProps<"button"> & {
  message: string;
  variant?: Parameters<typeof buttonClass>[0];
  size?: Parameters<typeof buttonClass>[1];
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={buttonClass(variant, size, className)}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * Formulario conectado a una server action que devuelve { error } / { ok }.
 * Muestra el mensaje resultante y opcionalmente se resetea al terminar bien.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (resetOnSuccess && state?.ok) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} className={className}>
      {state?.error && (
        <div className="mb-3">
          <Alert tone="error">{state.error}</Alert>
        </div>
      )}
      {state?.ok && (
        <div className="mb-3">
          <Alert tone="success">{state.ok}</Alert>
        </div>
      )}
      {children}
    </form>
  );
}
