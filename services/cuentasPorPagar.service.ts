import { ejecutarRPC } from "@/lib/supabase";

export type MovimientoBancoCxp = {
  monto: number;
  id_beneficiario: string;
};

export type TipoCxpCorrelativo = {
  tipo_cxp: string;
  ultimo_numero: number;
  siguiente_numero: number;
};

export type ProcesarCuentaPorPagarInput = {
  fecha: string;
  descripcion: string;
  tipoCxp: string;
  bancos: MovimientoBancoCxp[];
};

export type ResultadoProcesarCuentaPorPagar = {
  ok: boolean;
  mensaje: string;
  no_cxp_generado: number;
  registros_insertados: number;
  total: number;
};

export async function listarTiposCxpCorrelativos(): Promise<
  TipoCxpCorrelativo[]
> {
  const data = await ejecutarRPC("listar_tipos_cxp_correlativos", {});

  return (data ?? []).map((row: any) => ({
    tipo_cxp: String(row.tipo_cxp ?? ""),
    ultimo_numero: Number(row.ultimo_numero ?? 0),
    siguiente_numero: Number(row.siguiente_numero ?? 1),
  }));
}

export async function obtenerSiguienteNoCXP(tipoCxp: string): Promise<number> {
  if (!tipoCxp.trim()) {
    throw new Error("El tipo de CxP es obligatorio.");
  }

  const correlativos = await listarTiposCxpCorrelativos();

  const item = correlativos.find(
    (row) => row.tipo_cxp.trim() === tipoCxp.trim()
  );

  if (!item) {
    throw new Error(
      `No existe correlativo configurado para el tipo de CxP: ${tipoCxp}`
    );
  }

  return item.siguiente_numero;
}

export async function procesarCuentaPorPagar(
  input: ProcesarCuentaPorPagarInput
): Promise<ResultadoProcesarCuentaPorPagar> {
  if (!input.fecha) {
    throw new Error("La fecha es obligatoria.");
  }

  if (!input.descripcion.trim()) {
    throw new Error("La descripción es obligatoria.");
  }

  if (!input.tipoCxp.trim()) {
    throw new Error("El tipo de CxP es obligatorio.");
  }

  const descripcionNormalizada = input.descripcion.trim().toUpperCase();

  if (descripcionNormalizada !== "NULA" && input.bancos.length === 0) {
    throw new Error("No existen movimientos bancarios para procesar.");
  }

  const data = await ejecutarRPC("procesar_cuenta_por_pagar", {
    p_fecha: input.fecha,
    p_descripcion: input.descripcion.trim(),
    p_tipo_cxp: input.tipoCxp.trim(),
    p_bancos: input.bancos,
  });

  if (!data?.[0]) {
    throw new Error("La RPC no devolvió respuesta.");
  }

  return data[0] as ResultadoProcesarCuentaPorPagar;
}