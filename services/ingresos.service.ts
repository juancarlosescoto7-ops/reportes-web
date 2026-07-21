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
  id_arqueo?: string | number | null;
  id_deposito?: string | number | null;
  fecha_arqueo?: string | null;
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

export async function obtenerReporteIngresosEstricto(): Promise<
  IngresoReporte[]
> {
  const limite = 1_000;
  const maximoPaginas = 100;
  const registros: IngresoReporte[] = [];

  for (let pagina = 0; pagina < maximoPaginas; pagina += 1) {
    const desde = pagina * limite;
    const response = await fetch(
      "/api/supabase/rpc/reporte_arqueo_detallado_todos",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Range: `${desde}-${desde + limite - 1}`,
        },
        body: JSON.stringify({}),
      }
    );

    if (!response.ok) {
      const detalle = await response.text();
      throw new Error(
        `No se pudieron cargar los ingresos (${response.status}). ${detalle}`
      );
    }

    const data: unknown = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("El reporte de ingresos devolvio un formato inesperado.");
    }

    registros.push(...(data as IngresoReporte[]));

    const contentRange = response.headers.get("Content-Range");
    const totalTexto = contentRange?.split("/")[1];
    const total = totalTexto && totalTexto !== "*" ? Number(totalTexto) : null;

    if (
      data.length < limite ||
      (total !== null && Number.isFinite(total) && registros.length >= total)
    ) {
      return registros;
    }
  }

  throw new Error(
    "El reporte de ingresos supera el límite seguro de 100,000 registros."
  );
}
