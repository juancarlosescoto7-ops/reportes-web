export type DatosEditablesIngreso = {
  cuenta: string;
  tipo_ingreso: string;
  monto: number;
  fecha_deposito: string;
};

export type ValidarCorreccionIngresoInput = {
  original: DatosEditablesIngreso;
  actual: DatosEditablesIngreso;
  motivo: string;
  confirmacion: string;
};

export const TEXTO_CONFIRMACION_INGRESO = "CORREGIR";

export function normalizarFechaIngreso(
  value: string | null | undefined
): string {
  if (!value) return "";

  return String(value).trim().split("T")[0].split(" ")[0];
}

function normalizarTexto(value: string) {
  return value.trim();
}

function normalizarMonto(value: number) {
  return Number(Number(value).toFixed(2));
}

export function hayCambiosEnIngreso(
  original: DatosEditablesIngreso,
  actual: DatosEditablesIngreso
): boolean {
  return (
    normalizarTexto(original.cuenta) !== normalizarTexto(actual.cuenta) ||
    normalizarTexto(original.tipo_ingreso) !==
      normalizarTexto(actual.tipo_ingreso) ||
    normalizarMonto(original.monto) !== normalizarMonto(actual.monto) ||
    normalizarFechaIngreso(original.fecha_deposito) !==
      normalizarFechaIngreso(actual.fecha_deposito)
  );
}

export function validarCorreccionIngreso({
  original,
  actual,
  motivo,
  confirmacion,
}: ValidarCorreccionIngresoInput): string | null {
  if (
    !normalizarTexto(actual.cuenta) ||
    !normalizarTexto(actual.tipo_ingreso) ||
    !normalizarFechaIngreso(actual.fecha_deposito)
  ) {
    return "Complete la cuenta, el tipo de ingreso y la fecha del depósito.";
  }

  if (!Number.isFinite(actual.monto) || actual.monto <= 0) {
    return "El monto debe ser mayor que cero.";
  }

  if (!hayCambiosEnIngreso(original, actual)) {
    return "Modifique al menos un dato del depósito.";
  }

  if (normalizarTexto(motivo).length < 10) {
    return "Explique el motivo de la corrección con al menos 10 caracteres.";
  }

  if (normalizarTexto(confirmacion) !== TEXTO_CONFIRMACION_INGRESO) {
    return `Escriba ${TEXTO_CONFIRMACION_INGRESO} para confirmar el cambio.`;
  }

  return null;
}
