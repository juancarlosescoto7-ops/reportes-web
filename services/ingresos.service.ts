import { ejecutarRPC } from "@/lib/supabase";

export type IngresoDepositoInput = {
  monto: number;
  tipo_ingreso: string;
  cuenta: string;
  fecha_deposito: string;
};

export type CrearArqueoInput = {
  fecha: string;
  descripcion: string;
  depositos: IngresoDepositoInput[];
};

export type IngresoReporte = {
  fecha: string | null;
  descripcion: string | null;
  total: number | null;
  bloque: number | null;
  fecha_deposito: string | null;
  monto: number | null;
  tipo_ingreso: string | null;
  cuenta: string | null;
};

export const CUENTAS_INGRESOS = [
  "Tributarios: 2020718737",
  "Pagadora: 2010092311",
  "DEMAS: 2020718233",
  "Bomberos: 2010092313",
  "Transferencias: 2020718239",
  "Recaudadora Banrural: 73310009376",
  "Transferencias Banrural: 73310009380"
];

export const TIPOS_INGRESO = ["15-013-01", "11-001-01"];

export async function crearArqueoCompleto(
  input: CrearArqueoInput
): Promise<string> {
  const data = await ejecutarRPC("crear_arqueo_completo", {
    p_fecha: input.fecha,
    p_descripcion: input.descripcion,
    p_depositos: input.depositos.map((deposito) => ({
      monto: Number(deposito.monto),
      tipo_ingreso: deposito.tipo_ingreso,
      cuenta: deposito.cuenta,
      fecha_deposito: deposito.fecha_deposito,
    })),
  });

  if (typeof data === "string") {
    return data;
  }

  if (Array.isArray(data)) {
    return String(data[0] ?? "");
  }

  if (data && typeof data === "object") {
    return String(
      data.id ?? data.crear_arqueo_completo ?? data.resultado ?? ""
    );
  }

  return "";
}

export async function obtenerReporteIngresos(): Promise<IngresoReporte[]> {
  const data = await ejecutarRPC("reporte_arqueo_detallado_todos", {});

  return Array.isArray(data) ? (data as IngresoReporte[]) : [];
}
