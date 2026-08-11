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
  codigosObra,
}: {
  fila: FilaPresupuestoProyecto;
  idProyecto: string;
  codigosPresupuestarios: Set<string>;
  codigosObra: Set<string>;
}) {
  const idExplicito = primerValor(fila, ["proyecto_id", "id_proyecto"]);

  if (
    idExplicito !== null &&
    normalizarClave(idExplicito) === idProyecto
  ) {
    return true;
  }

  const codigoObra = normalizarClave(
    primerValor(fila, ["obra_id", "codigo_obra"])
  );

  if (codigoObra && codigosObra.has(codigoObra)) {
    return true;
  }

  if (idExplicito !== null) {
    return false;
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
  codigosObra = [],
}: {
  filas: FilaPresupuestoProyecto[];
  idProyecto: string | number | null;
  codigosPresupuestarios?: string[];
  codigosObra?: string[];
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
  const codigosObraNormalizados = new Set(
    codigosObra.map(normalizarClave).filter(Boolean)
  );

  for (const fila of filas) {
    if (
      !perteneceAlProyecto({
        fila,
        idProyecto: idNormalizado,
        codigosPresupuestarios: codigosNormalizados,
        codigosObra: codigosObraNormalizados,
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

export function obtenerCodigosPresupuestariosProyecto({
  filas,
  idProyecto,
  codigosPresupuestarios = [],
  codigosObra = [],
}: {
  filas: FilaPresupuestoProyecto[];
  idProyecto: string | number | null;
  codigosPresupuestarios?: string[];
  codigosObra?: string[];
}) {
  const idNormalizado = normalizarClave(idProyecto);

  if (!idNormalizado) return [];

  const codigosReferencia = new Set(
    codigosPresupuestarios.map(normalizarClave).filter(Boolean)
  );
  const codigosObraReferencia = new Set(
    codigosObra.map(normalizarClave).filter(Boolean)
  );
  const codigos = new Map<string, string>();

  for (const fila of filas) {
    if (
      !perteneceAlProyecto({
        fila,
        idProyecto: idNormalizado,
        codigosPresupuestarios: codigosReferencia,
        codigosObra: codigosObraReferencia,
      })
    ) {
      continue;
    }

    const codigo = String(
      primerValor(fila, ["codigo", "codigo_presupuestario"]) ?? ""
    ).trim();
    const clave = normalizarClave(codigo);

    if (clave && !codigos.has(clave)) {
      codigos.set(clave, codigo);
    }
  }

  return Array.from(codigos.values()).sort((a, b) =>
    a.localeCompare(b, "es", { numeric: true, sensitivity: "base" })
  );
}
