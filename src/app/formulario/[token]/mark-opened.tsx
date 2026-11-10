"use client";

import { useEffect } from "react";
import { markFormOpened } from "./actions";

/** Marca el pedido como "Abierto" cuando lo abre el cliente en su navegador (las vistas previas no corren esto). */
export function MarkOpened({ token }: { token: string }) {
  useEffect(() => {
    void markFormOpened(token);
  }, [token]);
  return null;
}
