export type MovimientoBancario = {
  id: string;
  fila: number;
  numero: string;
  fecha: string;
  tipo: string;
  descripcion: string;
  referencia: string;
  agencia: string;
  debitoCentavos: number;
  creditoCentavos: number;
  saldoCentavos: number | null;
};

export type FilaEstadoCuenta = {
  fila: number;
  motivo: string;
  valores: string[];
};

export type ResultadoParseoEstadoCuenta = {
  movimientos: MovimientoBancario[];
  filasInvalidas: FilaEstadoCuenta[];
  filasIgnoradas: FilaEstadoCuenta[];
  advertencias: string[];
  filaEncabezados: number;
};

export type DepositoSistemaConciliacion = {
  id: string;
  fecha: string;
  montoCentavos: number;
  cuenta: string;
  bloque?: string | number | null;
  tipoIngreso?: string | null;
  fechaArqueo?: string | null;
  descripcion?: string | null;
  orden?: number;
};

export type EstadoPartidaConciliacion =
  | "perfecto"
  | "revisar"
  | "nota_credito"
  | "nota_debito";

export type PartidaConciliacion = {
  id: string;
  estado: EstadoPartidaConciliacion;
  banco: MovimientoBancario | null;
  sistema: DepositoSistemaConciliacion | null;
  montoCentavos: number;
  diferenciaDias: number | null;
  diferenciaDiasFirmada: number | null;
  esAmbiguo: boolean;
};

export type MetricaConciliacion = {
  cantidad: number;
  totalCentavos: number;
};

export type ResumenConciliacion = {
  creditosBanco: MetricaConciliacion;
  depositosSistema: MetricaConciliacion;
  perfectos: MetricaConciliacion;
  porRevisar: MetricaConciliacion;
  notasCredito: MetricaConciliacion;
  notasDebito: MetricaConciliacion;
  debitosBancarios: MetricaConciliacion;
  diferenciaControlCentavos: number;
};

export type ResultadoConciliacion = {
  partidas: PartidaConciliacion[];
  debitosBancarios: MovimientoBancario[];
  resumen: ResumenConciliacion;
  toleranciaDias: number;
};

export type ResumenTotalConciliacion = {
  totalSistemaCentavos: number;
  notasCreditoCentavos: number;
  notasDebitoCentavos: number;
  totalSistemaAjustadoCentavos: number;
  totalBancoCentavos: number;
  diferenciaFinalCentavos: number;
  cuadra: boolean;
  conciliado: boolean;
  requiereRevision: boolean;
};

export function calcularResumenTotalConciliacion(
  resumen: ResumenConciliacion
): ResumenTotalConciliacion {
  const totalSistemaAjustadoCentavos =
    resumen.depositosSistema.totalCentavos +
    resumen.notasCredito.totalCentavos -
    resumen.notasDebito.totalCentavos;
  const diferenciaFinalCentavos =
    totalSistemaAjustadoCentavos - resumen.creditosBanco.totalCentavos;
  const cuadra = diferenciaFinalCentavos === 0;
  const requiereRevision = resumen.porRevisar.cantidad > 0;

  return {
    totalSistemaCentavos: resumen.depositosSistema.totalCentavos,
    notasCreditoCentavos: resumen.notasCredito.totalCentavos,
    notasDebitoCentavos: resumen.notasDebito.totalCentavos,
    totalSistemaAjustadoCentavos,
    totalBancoCentavos: resumen.creditosBanco.totalCentavos,
    diferenciaFinalCentavos,
    cuadra,
    conciliado: cuadra && !requiereRevision,
    requiereRevision,
  };
}

const MILISEGUNDOS_DIA = 86_400_000;

function crearFechaIso(year: number, month: number, day: number) {
  const fecha = new Date(Date.UTC(year, month - 1, day));

  if (
    fecha.getUTCFullYear() !== year ||
    fecha.getUTCMonth() !== month - 1 ||
    fecha.getUTCDate() !== day
  ) {
    return null;
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(
    2,
    "0"
  )}-${String(day).padStart(2, "0")}`;
}

export function normalizarFechaBancaria(value: string | number) {
  const texto = String(value ?? "").trim();

  if (!texto) return null;

  if (/^\d{1,5}(?:[.,]\d+)?$/.test(texto)) {
    const serial = Number(texto.replace(",", "."));

    if (Number.isFinite(serial) && serial >= 1 && serial < 80_000) {
      const fecha = new Date(
        Date.UTC(1899, 11, 30) + Math.floor(serial) * MILISEGUNDOS_DIA
      );

      return fecha.toISOString().slice(0, 10);
    }
  }

  const sufijoHora =
    "(?:[T\\s]\\d{1,2}:\\d{2}(?::\\d{2}(?:\\.\\d+)?)?(?:Z|[+-]\\d{2}:?\\d{2})?)?";
  const iso = texto.match(
    new RegExp(`^(\\d{4})[/-](\\d{1,2})[/-](\\d{1,2})${sufijoHora}$`)
  );

  if (iso) {
    return crearFechaIso(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  const local = texto.match(
    new RegExp(
      `^(\\d{1,2})[/.-](\\d{1,2})[/.-](\\d{4}|\\d{2})${sufijoHora}$`
    )
  );

  if (local) {
    const yearValue = Number(local[3]);
    const year =
      local[3].length === 2
        ? yearValue <= 69
          ? 2000 + yearValue
          : 1900 + yearValue
        : yearValue;

    return crearFechaIso(year, Number(local[2]), Number(local[1]));
  }

  return null;
}

export function montoACentavos(
  value: string | number | null | undefined
): number | null {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value * 100) : null;
  }

  const original = value.trim();

  if (!original) return 0;
  if (/^[-–—]$/.test(original)) return 0;

  let texto = original
    .replace(
      /(?:\bHNL\b|\bL(?:PS?)?\b\.?|\bLEMPIRAS?\b|\bUSD\b)/gi,
      ""
    )
    .replace(/US\$/gi, "")
    .replace(/[$\s]/g, "")
    .trim();
  let negativo = false;

  if (/^\(.*\)$/.test(texto)) {
    negativo = true;
    texto = texto.slice(1, -1);
  } else if (texto.startsWith("-")) {
    negativo = true;
    texto = texto.slice(1);
  }

  if (!texto || /[^\d.,]/.test(texto)) return null;

  const limpio = texto;

  if (!/\d/.test(limpio)) return null;

  const ultimaComa = limpio.lastIndexOf(",");
  const ultimoPunto = limpio.lastIndexOf(".");
  let normalizado = limpio;

  if (ultimaComa >= 0 && ultimoPunto >= 0) {
    const posicionDecimal = Math.max(ultimaComa, ultimoPunto);
    const enteros = limpio.slice(0, posicionDecimal).replace(/[.,]/g, "");
    const decimales = limpio.slice(posicionDecimal + 1).replace(/[.,]/g, "");
    normalizado = decimales ? `${enteros}.${decimales}` : enteros;
  } else if (ultimaComa >= 0 || ultimoPunto >= 0) {
    const separador = ultimaComa >= 0 ? "," : ".";
    const partes = limpio.split(separador);
    const ultimaParte = partes.at(-1) ?? "";

    if (partes.length === 2 && ultimaParte.length > 0 && ultimaParte.length <= 2) {
      normalizado = `${partes[0] || "0"}.${ultimaParte}`;
    } else if (partes.length > 2 && ultimaParte.length > 0 && ultimaParte.length <= 2) {
      normalizado = `${partes.slice(0, -1).join("")}.${ultimaParte}`;
    } else {
      normalizado = partes.join("");
    }
  }

  const numero = Number(normalizado) * (negativo ? -1 : 1);

  if (!Number.isFinite(numero)) return null;

  const centavos = Math.round(numero * 100);

  return Number.isSafeInteger(centavos) ? centavos : null;
}

export function montoCoincideConBusqueda(
  montoCentavos: number,
  busqueda: string
) {
  const texto = busqueda
    .trim()
    .replace(
      /(?:\bHNL\b|\bL(?:PS?)?\b\.?|\bLEMPIRAS?\b|\bUSD\b)/gi,
      ""
    )
    .replace(/US\$/gi, "")
    .replace(/[$\s]/g, "");

  if (!texto || /[^\d.,]/.test(texto)) return false;

  const digitosBusqueda = texto.replace(/\D/g, "");
  if (!digitosBusqueda) return false;

  const centavosAbsolutos = Math.abs(Math.trunc(montoCentavos));
  const digitosMonto = `${Math.floor(centavosAbsolutos / 100)}${String(
    centavosAbsolutos % 100
  ).padStart(2, "0")}`;

  return digitosMonto.includes(digitosBusqueda);
}

function normalizarEncabezado(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function parsearTextoDelimitado(texto: string, separador: string) {
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = "";
  let entreComillas = false;

  for (let index = 0; index < texto.length; index += 1) {
    const caracter = texto[index];
    const siguiente = texto[index + 1];

    if (caracter === '"' && entreComillas && siguiente === '"') {
      celda += '"';
      index += 1;
      continue;
    }

    if (caracter === '"' && entreComillas) {
      entreComillas = false;
      continue;
    }

    if (caracter === '"' && celda.length === 0) {
      entreComillas = true;
      continue;
    }

    if (caracter === separador && !entreComillas) {
      fila.push(celda);
      celda = "";
      continue;
    }

    if ((caracter === "\n" || caracter === "\r") && !entreComillas) {
      if (caracter === "\r" && siguiente === "\n") index += 1;
      fila.push(celda);

      if (fila.some((valor) => valor.trim())) filas.push(fila);

      fila = [];
      celda = "";
      continue;
    }

    celda += caracter;
  }

  if (entreComillas) {
    throw new Error(
      "Hay una celda con comillas sin cerrar en el estado de cuenta."
    );
  }

  fila.push(celda);
  if (fila.some((valor) => valor.trim())) filas.push(fila);

  return filas;
}

const ALIASES_ENCABEZADOS = {
  numero: ["no", "n", "numero", "numeromovimiento"],
  fecha: ["fecha", "fechamovimiento", "fechatransaccion"],
  tipo: ["tipo", "tipomovimiento"],
  descripcion: ["descripcion", "detalle", "concepto"],
  referencia: ["referencia", "ref"],
  agencia: ["agencia", "sucursal"],
  debito: ["debito", "debitos", "cargo", "cargos", "debe"],
  credito: ["credito", "creditos", "abono", "abonos", "haber"],
  saldo: ["saldo", "balance"],
} as const;

type CampoEncabezado = keyof typeof ALIASES_ENCABEZADOS;

function obtenerMapaEncabezados(fila: string[]) {
  const mapa = new Map<CampoEncabezado, number>();

  fila.forEach((valor, index) => {
    const normalizado = normalizarEncabezado(valor);

    (Object.keys(ALIASES_ENCABEZADOS) as CampoEncabezado[]).forEach((campo) => {
      if (
        !mapa.has(campo) &&
        (ALIASES_ENCABEZADOS[campo] as readonly string[]).includes(normalizado)
      ) {
        mapa.set(campo, index);
      }
    });
  });

  return mapa;
}

export function parsearEstadoCuentaPegado(
  texto: string
): ResultadoParseoEstadoCuenta {
  if (!texto.trim()) {
    throw new Error("Pegue primero los movimientos del estado de cuenta.");
  }

  let errorComillas: Error | null = null;
  const estructuras = ["\t", ";", ","]
    .map((separador, prioridad) => {
      try {
        const filas = parsearTextoDelimitado(texto, separador);

        for (let index = 0; index < Math.min(filas.length, 25); index += 1) {
          const mapa = obtenerMapaEncabezados(filas[index]);

          if (mapa.has("fecha") && mapa.has("debito") && mapa.has("credito")) {
            return {
              filas,
              filaEncabezados: index,
              mapaEncabezados: mapa,
              campos: mapa.size,
              prioridad,
            };
          }
        }
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes("comillas sin cerrar")
        ) {
          errorComillas = error;
          return { prioridad };
        }
        throw error;
      }

      return { prioridad };
    })
    .filter(
      (
        item
      ): item is {
        filas: string[][];
        filaEncabezados: number;
        mapaEncabezados: Map<CampoEncabezado, number>;
        campos: number;
        prioridad: number;
      } => "filas" in item
    )
    .sort((a, b) => b.campos - a.campos || a.prioridad - b.prioridad);

  if (estructuras.length === 0) {
    if (errorComillas) throw errorComillas;

    throw new Error(
      'No se encontraron los encabezados "Fecha", "Débitos" y "Créditos". Incluya la fila de encabezados al copiar desde Excel.'
    );
  }

  const { filas, filaEncabezados, mapaEncabezados } = estructuras[0];

  if (filas.length > 50_000) {
    throw new Error(
      "El estado de cuenta supera el límite de 50,000 filas por conciliación."
    );
  }

  const movimientos: MovimientoBancario[] = [];
  const filasInvalidas: FilaEstadoCuenta[] = [];
  const filasIgnoradas: FilaEstadoCuenta[] = [];
  const advertencias: string[] = [];
  const valor = (fila: string[], campo: CampoEncabezado) => {
    const index = mapaEncabezados.get(campo);
    return index === undefined ? "" : (fila[index] ?? "").trim();
  };

  filas.slice(filaEncabezados + 1).forEach((fila, posicion) => {
    const numeroFila = filaEncabezados + posicion + 2;

    if (!fila.some((item) => item.trim())) return;

    const posibleEncabezado = obtenerMapaEncabezados(fila);
    if (
      posibleEncabezado.has("fecha") &&
      posibleEncabezado.has("debito") &&
      posibleEncabezado.has("credito")
    ) {
      filasIgnoradas.push({
        fila: numeroFila,
        motivo: "Encabezado repetido",
        valores: fila,
      });
      return;
    }

    const fechaOriginal = valor(fila, "fecha");
    const fecha = normalizarFechaBancaria(fechaOriginal);
    const debitoOriginal = valor(fila, "debito");
    const creditoOriginal = valor(fila, "credito");
    const saldoOriginal = valor(fila, "saldo");
    const debitoCentavos = montoACentavos(debitoOriginal);
    const creditoCentavos = montoACentavos(creditoOriginal);
    const saldoCentavos = saldoOriginal ? montoACentavos(saldoOriginal) : null;

    if (!fecha) {
      filasInvalidas.push({
        fila: numeroFila,
        motivo: `Fecha inválida: ${fechaOriginal || "vacía"}`,
        valores: fila,
      });
      return;
    }

    if (debitoCentavos === null || creditoCentavos === null) {
      filasInvalidas.push({
        fila: numeroFila,
        motivo: "Débito o crédito no numérico",
        valores: fila,
      });
      return;
    }

    if (debitoCentavos < 0 || creditoCentavos < 0) {
      filasInvalidas.push({
        fila: numeroFila,
        motivo: "Los débitos y créditos deben ser positivos",
        valores: fila,
      });
      return;
    }

    if (debitoCentavos > 0 && creditoCentavos > 0) {
      filasInvalidas.push({
        fila: numeroFila,
        motivo: "La fila tiene débito y crédito al mismo tiempo",
        valores: fila,
      });
      return;
    }

    if (debitoCentavos === 0 && creditoCentavos === 0) {
      filasIgnoradas.push({
        fila: numeroFila,
        motivo: "Fila sin débito ni crédito",
        valores: fila,
      });
      return;
    }

    if (saldoOriginal && saldoCentavos === null) {
      advertencias.push(
        `Fila ${numeroFila}: el saldo no es numérico y se dejó vacío.`
      );
    }

    movimientos.push({
      id: `banco-${numeroFila}`,
      fila: numeroFila,
      numero: valor(fila, "numero"),
      fecha,
      tipo: valor(fila, "tipo"),
      descripcion: valor(fila, "descripcion"),
      referencia: valor(fila, "referencia"),
      agencia: valor(fila, "agencia"),
      debitoCentavos,
      creditoCentavos,
      saldoCentavos,
    });
  });

  return {
    movimientos,
    filasInvalidas,
    filasIgnoradas,
    advertencias,
    filaEncabezados: filaEncabezados + 1,
  };
}

function fechaADias(fecha: string) {
  const match = fecha.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return null;

  const iso = crearFechaIso(Number(match[1]), Number(match[2]), Number(match[3]));
  if (!iso) return null;

  return Math.floor(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) /
      MILISEGUNDOS_DIA
  );
}

type BancoIndexado = {
  movimiento: MovimientoBancario;
  indice: number;
  dias: number;
};

type SistemaIndexado = {
  deposito: DepositoSistemaConciliacion;
  indice: number;
  dias: number;
};

function esMejor(
  cantidad: number,
  costo: number,
  mejorCantidad: number,
  mejorCosto: number
) {
  return cantidad > mejorCantidad || (cantidad === mejorCantidad && costo < mejorCosto);
}

function emparejarCercanosOptimos(
  sistemas: SistemaIndexado[],
  bancos: BancoIndexado[],
  toleranciaDias: number
) {
  if (sistemas.length * bancos.length > 4_000_000) {
    throw new Error(
      "Hay demasiados movimientos repetidos con el mismo monto. Reduzca el período para poder asignarlos de forma segura."
    );
  }

  const sistemasOrdenados = [...sistemas].sort(
    (a, b) =>
      a.dias - b.dias ||
      a.deposito.id.localeCompare(b.deposito.id) ||
      (a.deposito.orden ?? a.indice) - (b.deposito.orden ?? b.indice)
  );
  const bancosOrdenados = [...bancos].sort(
    (a, b) =>
      a.dias - b.dias ||
      a.movimiento.fila - b.movimiento.fila ||
      a.movimiento.id.localeCompare(b.movimiento.id)
  );
  const filas = sistemasOrdenados.length + 1;
  const columnas = bancosOrdenados.length + 1;
  const acciones = new Uint8Array(filas * columnas);
  let cantidadesAnteriores = new Int32Array(columnas);
  let costosAnteriores = new Float64Array(columnas);

  for (let j = 1; j < columnas; j += 1) acciones[j] = 2;

  for (let i = 1; i < filas; i += 1) {
    const cantidadesActuales = new Int32Array(columnas);
    const costosActuales = new Float64Array(columnas);
    acciones[i * columnas] = 1;

    for (let j = 1; j < columnas; j += 1) {
      let mejorCantidad = cantidadesAnteriores[j];
      let mejorCosto = costosAnteriores[j];
      let accion = 1;
      const cantidadIzquierda = cantidadesActuales[j - 1];
      const costoIzquierda = costosActuales[j - 1];

      if (
        esMejor(
          cantidadIzquierda,
          costoIzquierda,
          mejorCantidad,
          mejorCosto
        )
      ) {
        mejorCantidad = cantidadIzquierda;
        mejorCosto = costoIzquierda;
        accion = 2;
      }

      const diferencia = Math.abs(
        sistemasOrdenados[i - 1].dias - bancosOrdenados[j - 1].dias
      );

      if (diferencia > 0 && diferencia <= toleranciaDias) {
        const cantidadMatch = cantidadesAnteriores[j - 1] + 1;
        const costoMatch = costosAnteriores[j - 1] + diferencia;

        if (
          esMejor(cantidadMatch, costoMatch, mejorCantidad, mejorCosto) ||
          (cantidadMatch === mejorCantidad && costoMatch === mejorCosto)
        ) {
          mejorCantidad = cantidadMatch;
          mejorCosto = costoMatch;
          accion = 3;
        }
      }

      cantidadesActuales[j] = mejorCantidad;
      costosActuales[j] = mejorCosto;
      acciones[i * columnas + j] = accion;
    }

    cantidadesAnteriores = cantidadesActuales;
    costosAnteriores = costosActuales;
  }

  const pares: Array<[SistemaIndexado, BancoIndexado]> = [];
  let i = sistemasOrdenados.length;
  let j = bancosOrdenados.length;

  while (i > 0 || j > 0) {
    const accion = acciones[i * columnas + j];

    if (accion === 3) {
      pares.push([sistemasOrdenados[i - 1], bancosOrdenados[j - 1]]);
      i -= 1;
      j -= 1;
    } else if (accion === 1) {
      i -= 1;
    } else {
      j -= 1;
    }
  }

  return pares.reverse();
}

function metrica(partidas: PartidaConciliacion[], estado: EstadoPartidaConciliacion) {
  const items = partidas.filter((partida) => partida.estado === estado);

  return {
    cantidad: items.length,
    totalCentavos: items.reduce((total, item) => total + item.montoCentavos, 0),
  };
}

export function conciliarDepositos(
  movimientos: MovimientoBancario[],
  depositos: DepositoSistemaConciliacion[],
  toleranciaDias = 3
): ResultadoConciliacion {
  if (!Number.isInteger(toleranciaDias) || toleranciaDias < 0 || toleranciaDias > 31) {
    throw new Error("La tolerancia debe ser un número entero entre 0 y 31 días.");
  }

  const idsBanco = new Set<string>();
  movimientos.forEach((movimiento) => {
    if (idsBanco.has(movimiento.id)) {
      throw new Error(`El identificador bancario ${movimiento.id} está duplicado.`);
    }
    idsBanco.add(movimiento.id);

    if (
      !Number.isSafeInteger(movimiento.debitoCentavos) ||
      !Number.isSafeInteger(movimiento.creditoCentavos) ||
      movimiento.debitoCentavos < 0 ||
      movimiento.creditoCentavos < 0 ||
      (movimiento.debitoCentavos > 0 && movimiento.creditoCentavos > 0)
    ) {
      throw new Error(
        `La fila bancaria ${movimiento.fila} tiene débitos o créditos inválidos.`
      );
    }

    if (fechaADias(movimiento.fecha) === null) {
      throw new Error(`La fila bancaria ${movimiento.fila} tiene una fecha inválida.`);
    }
  });

  const idsSistema = new Set<string>();
  depositos.forEach((deposito) => {
    if (idsSistema.has(deposito.id)) {
      throw new Error(`El identificador interno ${deposito.id} está duplicado.`);
    }
    idsSistema.add(deposito.id);
  });

  const creditos: BancoIndexado[] = movimientos
    .map((movimiento, indice) => {
      const dias = fechaADias(movimiento.fecha);
      return dias === null ? null : { movimiento, indice, dias };
    })
    .filter(
      (item): item is BancoIndexado =>
        Boolean(item && item.movimiento.creditoCentavos > 0)
    );
  const sistemas: SistemaIndexado[] = depositos.map((deposito, indice) => {
    const dias = fechaADias(deposito.fecha);

    if (dias === null || !Number.isSafeInteger(deposito.montoCentavos) || deposito.montoCentavos <= 0) {
      throw new Error(`El depósito interno ${deposito.id} tiene fecha o monto inválido.`);
    }

    return { deposito, indice, dias };
  });
  const usadosBanco = new Set<number>();
  const usadosSistema = new Set<number>();
  const partidas: PartidaConciliacion[] = [];
  const bancosPorExacto = new Map<string, BancoIndexado[]>();
  const sistemasPorExacto = new Map<string, SistemaIndexado[]>();

  creditos.forEach((item) => {
    const key = `${item.movimiento.creditoCentavos}|${item.movimiento.fecha}`;
    bancosPorExacto.set(key, [...(bancosPorExacto.get(key) ?? []), item]);
  });
  sistemas.forEach((item) => {
    const key = `${item.deposito.montoCentavos}|${item.deposito.fecha}`;
    sistemasPorExacto.set(key, [...(sistemasPorExacto.get(key) ?? []), item]);
  });

  Array.from(bancosPorExacto.keys())
    .sort()
    .forEach((key) => {
      const bancos = [...(bancosPorExacto.get(key) ?? [])].sort(
        (a, b) =>
          a.movimiento.fila - b.movimiento.fila ||
          a.movimiento.id.localeCompare(b.movimiento.id)
      );
      const registros = [...(sistemasPorExacto.get(key) ?? [])].sort(
        (a, b) =>
          a.deposito.id.localeCompare(b.deposito.id) ||
          (a.deposito.orden ?? a.indice) -
            (b.deposito.orden ?? b.indice)
      );
      const cantidad = Math.min(bancos.length, registros.length);
      const ambiguo = bancos.length > 1 || registros.length > 1;

      for (let index = 0; index < cantidad; index += 1) {
        const banco = bancos[index];
        const sistema = registros[index];
        usadosBanco.add(banco.indice);
        usadosSistema.add(sistema.indice);
        partidas.push({
          id: `perfecto-${banco.indice}-${sistema.indice}`,
          estado: "perfecto",
          banco: banco.movimiento,
          sistema: sistema.deposito,
          montoCentavos: banco.movimiento.creditoCentavos,
          diferenciaDias: 0,
          diferenciaDiasFirmada: 0,
          esAmbiguo: ambiguo,
        });
      }
    });

  const bancosRestantes = creditos.filter((item) => !usadosBanco.has(item.indice));
  const sistemasRestantes = sistemas.filter(
    (item) => !usadosSistema.has(item.indice)
  );
  const bancosPorMonto = new Map<number, BancoIndexado[]>();
  const sistemasPorMonto = new Map<number, SistemaIndexado[]>();

  bancosRestantes.forEach((item) => {
    const monto = item.movimiento.creditoCentavos;
    bancosPorMonto.set(monto, [...(bancosPorMonto.get(monto) ?? []), item]);
  });
  sistemasRestantes.forEach((item) => {
    const monto = item.deposito.montoCentavos;
    sistemasPorMonto.set(monto, [...(sistemasPorMonto.get(monto) ?? []), item]);
  });

  Array.from(bancosPorMonto.keys())
    .sort((a, b) => a - b)
    .forEach((monto) => {
      const bancos = bancosPorMonto.get(monto) ?? [];
      const registros = sistemasPorMonto.get(monto) ?? [];
      const pares = emparejarCercanosOptimos(registros, bancos, toleranciaDias);

      pares.forEach(([sistema, banco]) => {
        usadosBanco.add(banco.indice);
        usadosSistema.add(sistema.indice);
        const diferenciaFirmada = banco.dias - sistema.dias;
        const candidatosParaBanco = registros.filter((item) => {
          const diferencia = Math.abs(item.dias - banco.dias);
          return diferencia > 0 && diferencia <= toleranciaDias;
        }).length;
        const candidatosParaSistema = bancos.filter((item) => {
          const diferencia = Math.abs(item.dias - sistema.dias);
          return diferencia > 0 && diferencia <= toleranciaDias;
        }).length;
        partidas.push({
          id: `revisar-${banco.indice}-${sistema.indice}`,
          estado: "revisar",
          banco: banco.movimiento,
          sistema: sistema.deposito,
          montoCentavos: monto,
          diferenciaDias: Math.abs(diferenciaFirmada),
          diferenciaDiasFirmada: diferenciaFirmada,
          esAmbiguo:
            candidatosParaBanco > 1 || candidatosParaSistema > 1,
        });
      });
    });

  creditos.forEach((banco) => {
    if (usadosBanco.has(banco.indice)) return;
    const monto = banco.movimiento.creditoCentavos;
    const exactKey = `${monto}|${banco.movimiento.fecha}`;
    partidas.push({
      id: `nota-credito-${banco.indice}`,
      estado: "nota_credito",
      banco: banco.movimiento,
      sistema: null,
      montoCentavos: banco.movimiento.creditoCentavos,
      diferenciaDias: null,
      diferenciaDiasFirmada: null,
      esAmbiguo:
        (bancosPorExacto.get(exactKey)?.length ?? 0) > 1 ||
        (sistemasPorExacto.get(exactKey)?.length ?? 0) > 1 ||
        (bancosPorMonto.get(monto)?.length ?? 0) > 1 ||
        (sistemasPorMonto.get(monto)?.length ?? 0) > 1,
    });
  });

  sistemas.forEach((sistema) => {
    if (usadosSistema.has(sistema.indice)) return;
    const monto = sistema.deposito.montoCentavos;
    const exactKey = `${monto}|${sistema.deposito.fecha}`;
    partidas.push({
      id: `nota-debito-${sistema.indice}`,
      estado: "nota_debito",
      banco: null,
      sistema: sistema.deposito,
      montoCentavos: sistema.deposito.montoCentavos,
      diferenciaDias: null,
      diferenciaDiasFirmada: null,
      esAmbiguo:
        (bancosPorExacto.get(exactKey)?.length ?? 0) > 1 ||
        (sistemasPorExacto.get(exactKey)?.length ?? 0) > 1 ||
        (bancosPorMonto.get(monto)?.length ?? 0) > 1 ||
        (sistemasPorMonto.get(monto)?.length ?? 0) > 1,
    });
  });

  const ordenEstado: Record<EstadoPartidaConciliacion, number> = {
    revisar: 0,
    nota_credito: 1,
    nota_debito: 2,
    perfecto: 3,
  };
  partidas.sort((a, b) => {
    const estado = ordenEstado[a.estado] - ordenEstado[b.estado];
    if (estado !== 0) return estado;
    const fechaA = a.banco?.fecha ?? a.sistema?.fecha ?? "";
    const fechaB = b.banco?.fecha ?? b.sistema?.fecha ?? "";
    return fechaA.localeCompare(fechaB) || a.id.localeCompare(b.id);
  });

  const debitosBancarios = movimientos.filter(
    (movimiento) => movimiento.debitoCentavos > 0
  );
  const totalCreditos = creditos.reduce(
    (total, item) => total + item.movimiento.creditoCentavos,
    0
  );
  const totalDepositos = depositos.reduce(
    (total, item) => total + item.montoCentavos,
    0
  );

  return {
    partidas,
    debitosBancarios,
    toleranciaDias,
    resumen: {
      creditosBanco: { cantidad: creditos.length, totalCentavos: totalCreditos },
      depositosSistema: {
        cantidad: depositos.length,
        totalCentavos: totalDepositos,
      },
      perfectos: metrica(partidas, "perfecto"),
      porRevisar: metrica(partidas, "revisar"),
      notasCredito: metrica(partidas, "nota_credito"),
      notasDebito: metrica(partidas, "nota_debito"),
      debitosBancarios: {
        cantidad: debitosBancarios.length,
        totalCentavos: debitosBancarios.reduce(
          (total, item) => total + item.debitoCentavos,
          0
        ),
      },
      diferenciaControlCentavos: totalCreditos - totalDepositos,
    },
  };
}

export function limitarResultadoConciliacionAlPeriodo(
  resultado: ResultadoConciliacion,
  fechaDesde: string,
  fechaHasta: string
): ResultadoConciliacion {
  if (
    fechaADias(fechaDesde) === null ||
    fechaADias(fechaHasta) === null ||
    fechaDesde > fechaHasta
  ) {
    throw new Error("El período de conciliación no es válido.");
  }

  const estaEnPeriodo = (fecha: string) =>
    fecha >= fechaDesde && fecha <= fechaHasta;
  const sistemaEstaEnPeriodo = (sistema: DepositoSistemaConciliacion) =>
    estaEnPeriodo(sistema.fechaArqueo ?? sistema.fecha);
  const partidas = resultado.partidas.filter((partida) => {
    if (partida.estado === "nota_credito") {
      return Boolean(partida.banco && estaEnPeriodo(partida.banco.fecha));
    }

    if (partida.estado === "nota_debito") {
      return Boolean(partida.sistema && sistemaEstaEnPeriodo(partida.sistema));
    }

    return Boolean(
      (partida.banco && estaEnPeriodo(partida.banco.fecha)) ||
        (partida.sistema && sistemaEstaEnPeriodo(partida.sistema))
    );
  });
  const bancosConsiderados = new Map<string, MovimientoBancario>();
  const depositosConsiderados = new Map<string, DepositoSistemaConciliacion>();

  partidas.forEach((partida) => {
    if (partida.banco) {
      bancosConsiderados.set(partida.banco.id, partida.banco);
    }
    if (partida.sistema) {
      depositosConsiderados.set(partida.sistema.id, partida.sistema);
    }
  });

  const totalCreditos = Array.from(bancosConsiderados.values()).reduce(
    (total, item) => total + item.creditoCentavos,
    0
  );
  const totalDepositos = Array.from(depositosConsiderados.values()).reduce(
    (total, item) => total + item.montoCentavos,
    0
  );
  const debitosBancarios = resultado.debitosBancarios.filter((movimiento) =>
    estaEnPeriodo(movimiento.fecha)
  );

  return {
    ...resultado,
    partidas,
    debitosBancarios,
    resumen: {
      ...resultado.resumen,
      creditosBanco: {
        cantidad: bancosConsiderados.size,
        totalCentavos: totalCreditos,
      },
      depositosSistema: {
        cantidad: depositosConsiderados.size,
        totalCentavos: totalDepositos,
      },
      perfectos: metrica(partidas, "perfecto"),
      porRevisar: metrica(partidas, "revisar"),
      notasCredito: metrica(partidas, "nota_credito"),
      notasDebito: metrica(partidas, "nota_debito"),
      debitosBancarios: {
        cantidad: debitosBancarios.length,
        totalCentavos: debitosBancarios.reduce(
          (total, item) => total + item.debitoCentavos,
          0
        ),
      },
      diferenciaControlCentavos: totalCreditos - totalDepositos,
    },
  };
}
