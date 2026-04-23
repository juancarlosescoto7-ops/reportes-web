import { ejecutarRPC } from "@/lib/supabase";

export type CXP = {
  cxp_id: number;
  fecha: string;
  descripcion: string;
  no_cxp: number;
  haber: number;

  codigo_presupuestario: string;
  monto_ejecutado: number;

  beneficiario_id: number;
  beneficiario_nombre: string;

  estado: string;
  tipo_cxp: string;

  decision_pago: "Pago total" | "Pago parcial" | "No pagar";
  motivo_pago: string;
};

export async function obtenerCXP() {
  const data = await ejecutarRPC("obtener_cxp_totalmente_ejecutadas", {});
  return data as CXP[];
}