export type FilaPresupuestoProyecto = Record<string, unknown>;

export type ResumenPresupuestoProyecto = {
  presupuestoInicial: number;
  montoVigente: number;
  montoEjecutado: number;
  montoComprometido: number;
  cantidadPartidas: number;
};

function normalizarClave(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

function convertirNumero(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const numero = Number(
    String(value)
      .replace(/L\.?/gi, "")
      .replace(/,/g, "")
      .trim()
  );

  return Number.isFinite(numero) ? numero : 0;
}

function primerValor(fila: FilaPresupuestoProyecto, claves: string[]) {
  for (const clave of claves) {
    const valor = fila[clave];

    if (valor !== null && valor !== undefined && String(valor).trim()) {
      return valor;
    }
  }

  return null;
}

function perteneceAlProyecto({
  fila,
  idProyecto,
  codigosPresupuestarios,
}: {
  fila: FilaPresupuestoProyecto;
  idProyecto: string;
  codigosPresupuestarios: Set<string>;
}) {
  const idExplicito = primerValor(fila, ["proyecto_id", "id_proyecto"]);

  if (idExplicito !== null) {
    return normalizarClave(idExplicito) === idProyecto;
  }

  if (normalizarClave(fila.proyecto) === idProyecto) {
    return true;
  }

  const codigo = normalizarClave(
    primerValor(fila, ["codigo", "codigo_presupuestario"])
  );

  return Boolean(codigo && codigosPresupuestarios.has(codigo));
}

export function calcularResumenPresupuestoProyecto({
  filas,
  idProyecto,
  codigosPresupuestarios = [],
}: {
  filas: FilaPresupuestoProyecto[];
  idProyecto: string | number | null;
  codigosPresupuestarios?: string[];
}): ResumenPresupuestoProyecto {
  const resumen: ResumenPresupuestoProyecto = {
    presupuestoInicial: 0,
    montoVigente: 0,
    montoEjecutado: 0,
    montoComprometido: 0,
    cantidadPartidas: 0,
  };
  const idNormalizado = normalizarClave(idProyecto);

  if (!idNormalizado) return resumen;

  const codigosNormalizados = new Set(
    codigosPresupuestarios.map(normalizarClave).filter(Boolean)
  );

  for (const fila of filas) {
    if (
      !perteneceAlProyecto({
        fila,
        idProyecto: idNormalizado,
        codigosPresupuestarios: codigosNormalizados,
      })
    ) {
      continue;
    }

    resumen.presupuestoInicial += convertirNumero(
      primerValor(fila, ["presupuesto_inicial", "monto_inicial"])
    );
    resumen.montoVigente += convertirNumero(
      primerValor(fila, ["presupuesto_vigente", "monto_vigente", "vigente"])
    );
    resumen.montoEjecutado += convertirNumero(
      primerValor(fila, ["ejecutado", "monto_ejecutado"])
    );
    resumen.montoComprometido += convertirNumero(
      primerValor(fila, [
        "comprometido",
        "total_comprometido",
        "saldo_comprometido",
        "monto_comprometido",
      ])
    );
    resumen.cantidadPartidas += 1;
  }

  return resumen;
}
