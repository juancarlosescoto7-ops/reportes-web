// services/ordenesPago.ts
import { ejecutarRPC } from "@/lib/supabase";

export type OrdenPago = {
  codigo_programa: string;
  codigo_subprograma: string;
  codigo_proyecto: string;
  codigo_actividad: string;
  codigo_obra: string;
  codigo_presupuestario: string;
  objeto: string;
  descripcion_objeto: string;
  fuente: string;
  tipo_inversion: string;
  orden_pago_id: string | null;
  url: string | null;
};

export async function obtenerOrdenesPago() {
  const data = await ejecutarRPC(
    "rpc_codigos_presupuesto_estructura",
    {}
  );

  return data as OrdenPago[];
}