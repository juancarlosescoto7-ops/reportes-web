type DetalleCodigo = {
  codigo_presupuestario?: string | null;
  monto_pendiente?: number | null;
  saldo_codigo_actual?: number | null;
};

export type DatosFactibilidadPago = {
  no_cxp: number;
  tipo_cxp: string | null;
  saldo_real_cxp?: number;
  detalle_codigos?: DetalleCodigo[];
};

export type PagoParaAnalizar = {
  no_cxp: number;
  tipo_movimiento: string | null;
  monto_pago: number;
  saldo_real: number;
};

export type EstadoFactibilidad = "factible" | "insuficiente" | "sin_datos" | "invalido";
export type RecursoPago = {
  clave: string;
  nombre: string;
  disponible: number;
  solicitado: number;
};

const centavos = (monto: number) => Math.round(monto * 100);
const esNumero = (valor: unknown): valor is number =>
  typeof valor === "number" && Number.isFinite(valor);
const claveCxp = (numero: number, tipo: string | null) =>
  JSON.stringify([numero, tipo ?? ""]);

/** Evalúa únicamente el presupuesto vigente menos lo ejecutado,
 * sin descontar CxP ni compromisos y sin evaluar grupos financieros.
 * La distribución identifica los códigos que recibirían los pagos seleccionados.
 */
export function analizarFactibilidadPago(
  pagos: PagoParaAnalizar[],
  datos: DatosFactibilidadPago[]
) {
  const porCxp = new Map(datos.map((dato) => [claveCxp(dato.no_cxp, dato.tipo_cxp), dato]));
  const recursos = new Map<string, RecursoPago>();
  const resultados = pagos.map((pago) => {
    const dato = porCxp.get(claveCxp(pago.no_cxp, pago.tipo_movimiento));
    const saldo = dato?.saldo_real_cxp ?? pago.saldo_real;
    const base = { noCxp: pago.no_cxp, tipoMovimiento: pago.tipo_movimiento, claves: [] as string[] };
    if (!esNumero(pago.monto_pago) || centavos(pago.monto_pago) <= 0 ||
        !esNumero(saldo) || centavos(pago.monto_pago) > centavos(saldo)) {
      return { ...base, estado: "invalido" as EstadoFactibilidad, motivo: "Ingrese un monto mayor a cero que no supere el saldo pendiente." };
    }

    const codigos = dato?.detalle_codigos ?? [];
    const lineas = codigos.map((linea) => ({
      clave: JSON.stringify(["codigo", linea.codigo_presupuestario?.trim()]),
      nombre: linea.codigo_presupuestario?.trim(),
      disponible: linea.saldo_codigo_actual,
      pendiente: linea.monto_pendiente,
    }));
    const totalCodigos = codigos.reduce((total, linea) => total + (linea.monto_pendiente ?? 0), 0);
    if (!codigos.length ||
        centavos(totalCodigos) !== centavos(saldo) ||
        lineas.some((linea) => !linea.nombre || !esNumero(linea.disponible) ||
          !esNumero(linea.pendiente) || linea.pendiente < 0)) {
      return { ...base, estado: "sin_datos" as EstadoFactibilidad, motivo: "Faltan saldos o la distribución presupuestaria completa para analizar esta cuenta." };
    }

    for (const linea of lineas) {
      if (!linea.pendiente) continue;
      const solicitado = (centavos(pago.monto_pago) / 100) * linea.pendiente / saldo;
      const recurso = recursos.get(linea.clave);
      if (recurso) {
        recurso.solicitado += solicitado;
        recurso.disponible = Math.min(recurso.disponible, linea.disponible!);
      } else {
        recursos.set(linea.clave, { clave: linea.clave, nombre: linea.nombre!, disponible: linea.disponible!, solicitado });
      }
      base.claves.push(linea.clave);
    }
    return { ...base, estado: "factible" as EstadoFactibilidad, motivo: "El monto tiene cobertura en sus códigos presupuestarios." };
  });

  const detalle = Array.from(recursos.values()).map((recurso) => ({
    ...recurso,
    solicitado: centavos(recurso.solicitado) / 100,
    restante: (centavos(recurso.disponible) - centavos(recurso.solicitado)) / 100,
  }));
  const insuficientes = new Set(detalle.filter((recurso) => recurso.restante < 0).map((recurso) => recurso.clave));
  for (const resultado of resultados) {
    if (resultado.estado === "factible" && resultado.claves.some((clave) => insuficientes.has(clave))) {
      resultado.estado = "insuficiente";
      resultado.motivo = "Los pagos seleccionados superan el saldo de un código presupuestario.";
    }
  }
  const estado: EstadoFactibilidad = resultados.some((r) => r.estado === "invalido") || !resultados.length
    ? "invalido"
    : resultados.some((r) => r.estado === "sin_datos") ? "sin_datos"
    : insuficientes.size ? "insuficiente" : "factible";
  return { estado, cuentas: resultados, recursos: detalle };
}
