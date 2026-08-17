export type FilaPresupuestoOficinaMujerDB = Record<string, unknown>;
export type FilaResumenGrupoOficinaMujerDB = Record<string, unknown>;

export type EjeOficinaMujer = {
  eje: string;
  montoVigente: number;
  porcentajeEjecutable: number;
  montoEjecutable: number;
  montoEjecutado: number;
  montoComprometido: number;
  saldoEjecutable: number;
};

export type ReporteOficinaMujer = {
  grupo: string;
  nivelEje: string;
  montoVigenteGrupo: number;
  ejecutableGeneralGrupo: number;
  montoEjecutadoGrupo: number;
  montoComprometidoGrupo: number;
  saldoEjecutableGrupo: number;
  ejes: EjeOficinaMujer[];
};

type NivelEje = {
  etiqueta: string;
  nombres: string[];
};

const NIVELES_JERARQUIA: NivelEje[] = [
  {
    etiqueta: "Programa",
    nombres: ["programa_nombre", "nombre_programa", "programa"],
  },
  {
    etiqueta: "Subprograma",
    nombres: [
      "subprograma_nombre",
      "nombre_subprograma",
      "sub_programa_nombre",
      "subprograma",
      "sub_programa",
    ],
  },
  {
    etiqueta: "Proyecto",
    nombres: ["proyecto_nombre", "nombre_proyecto", "proyecto"],
  },
  {
    etiqueta: "Actividad",
    nombres: ["actividad_nombre", "nombre_actividad", "actividad"],
  },
  {
    etiqueta: "Obra",
    nombres: ["obra_nombre", "nombre_obra", "obra"],
  },
];

const PATRON_EJE = /(^|\s)EJE(?:\s|$|[-:0-9])/;

export function normalizarReporteOficinaMujer(
  presupuesto: FilaPresupuestoOficinaMujerDB[],
  resumenGrupos: FilaResumenGrupoOficinaMujerDB[]
): ReporteOficinaMujer {
  const nombreGrupoResumen = encontrarNombreGrupoResumen(resumenGrupos);
  const grupoDetectado = encontrarGrupoPresupuestario(
    presupuesto,
    nombreGrupoResumen
  );
  const filasGrupo = grupoDetectado.filas;
  const nivelesHijos =
    grupoDetectado.indiceNivel >= 0
      ? NIVELES_JERARQUIA.slice(grupoDetectado.indiceNivel + 1)
      : NIVELES_JERARQUIA.slice(1);
  const nivelEje = encontrarNivelEje(
    filasGrupo,
    nivelesHijos.length > 0 ? nivelesHijos : NIVELES_JERARQUIA
  );
  const acumuladoPorEje = new Map<
    string,
    Pick<
      EjeOficinaMujer,
      "eje" | "montoVigente" | "montoEjecutado" | "montoComprometido"
    >
  >();

  for (const fila of filasGrupo) {
    const eje =
      primerTexto(fila, nivelEje.nombres) ||
      "Sin eje presupuestario identificado";
    const actual = acumuladoPorEje.get(eje) ?? {
      eje,
      montoVigente: 0,
      montoEjecutado: 0,
      montoComprometido: 0,
    };

    actual.montoVigente += numero(fila.presupuesto_vigente);
    actual.montoEjecutado += numero(fila.ejecutado);
    actual.montoComprometido += numero(
      fila.comprometido ??
        fila.total_comprometido ??
        fila.saldo_comprometido ??
        fila.monto_comprometido
    );
    acumuladoPorEje.set(eje, actual);
  }

  const montoVigenteGrupo = Array.from(acumuladoPorEje.values()).reduce(
    (total, eje) => total + eje.montoVigente,
    0
  );
  const ejecutableGeneralGrupo = resumenGrupos.reduce((total, fila) => {
    const nombreGrupo = obtenerNombreGrupoResumen(fila);

    if (!coincideGrupoMujer(nombreGrupo, nombreGrupoResumen)) return total;

    return total + numero(fila.montopermitido ?? fila.MontoPermitido);
  }, 0);

  const ejes = Array.from(acumuladoPorEje.values())
    .map<EjeOficinaMujer>((eje) => {
      const porcentajeEjecutable =
        montoVigenteGrupo > 0
          ? (eje.montoVigente / montoVigenteGrupo) * 100
          : 0;
      const montoEjecutable =
        montoVigenteGrupo > 0
          ? ejecutableGeneralGrupo * (eje.montoVigente / montoVigenteGrupo)
          : 0;

      return {
        ...eje,
        porcentajeEjecutable,
        montoEjecutable,
        saldoEjecutable:
          montoEjecutable - eje.montoEjecutado - eje.montoComprometido,
      };
    })
    .sort((a, b) =>
      a.eje.localeCompare(b.eje, "es-HN", {
        numeric: true,
        sensitivity: "base",
      })
    );

  const montoEjecutadoGrupo = ejes.reduce(
    (total, eje) => total + eje.montoEjecutado,
    0
  );
  const montoComprometidoGrupo = ejes.reduce(
    (total, eje) => total + eje.montoComprometido,
    0
  );
  const grupo =
    grupoDetectado.nombre || nombreGrupoResumen || "Oficina de la Mujer";

  return {
    grupo,
    nivelEje: nivelEje.etiqueta,
    montoVigenteGrupo,
    ejecutableGeneralGrupo,
    montoEjecutadoGrupo,
    montoComprometidoGrupo,
    saldoEjecutableGrupo:
      ejecutableGeneralGrupo - montoEjecutadoGrupo - montoComprometidoGrupo,
    ejes,
  };
}

function encontrarGrupoPresupuestario(
  filas: FilaPresupuestoOficinaMujerDB[],
  nombreGrupoResumen: string
) {
  for (let indiceNivel = 0; indiceNivel < NIVELES_JERARQUIA.length; indiceNivel += 1) {
    const nivel = NIVELES_JERARQUIA[indiceNivel];
    const filasCoincidentes = filas.filter((fila) =>
      coincideGrupoMujer(
        primerTexto(fila, nivel.nombres),
        nombreGrupoResumen
      )
    );

    if (filasCoincidentes.length > 0) {
      return {
        filas: filasCoincidentes,
        indiceNivel,
        nombre: primerTexto(filasCoincidentes[0], nivel.nombres),
      };
    }
  }

  const filasCoincidentes = filas.filter((fila) =>
    NIVELES_JERARQUIA.some((nivel) =>
      coincideGrupoMujer(
        primerTexto(fila, nivel.nombres),
        nombreGrupoResumen
      )
    )
  );

  return {
    filas: filasCoincidentes,
    indiceNivel: -1,
    nombre: nombreGrupoResumen,
  };
}

function encontrarNivelEje(
  filas: FilaPresupuestoOficinaMujerDB[],
  niveles: NivelEje[]
): NivelEje {
  const estadisticas = niveles.map((nivel) => {
    const nombres = filas
      .map((fila) => primerTexto(fila, nivel.nombres))
      .filter(Boolean);

    return {
      nivel,
      nombresUnicos: new Set(nombres.map(normalizarTexto)).size,
      tieneNombreEje: nombres.some((nombre) =>
        PATRON_EJE.test(normalizarTexto(nombre))
      ),
      tieneDatos: nombres.length > 0,
    };
  });

  return (
    estadisticas.find((item) => item.tieneNombreEje)?.nivel ??
    estadisticas.find((item) => item.nombresUnicos > 1)?.nivel ??
    estadisticas.find((item) => item.tieneDatos)?.nivel ??
    niveles[0] ?? NIVELES_JERARQUIA[NIVELES_JERARQUIA.length - 1]
  );
}

function encontrarNombreGrupoResumen(
  filas: FilaResumenGrupoOficinaMujerDB[]
) {
  for (const fila of filas) {
    const nombre = obtenerNombreGrupoResumen(fila);

    if (contieneMujer(nombre)) return nombre;
  }

  return "";
}

function obtenerNombreGrupoResumen(fila: FilaResumenGrupoOficinaMujerDB) {
  const tipo = primerTexto(fila, ["tipo", "Tipo"]);

  if (contieneMujer(tipo)) return tipo;

  const fuente = primerTexto(fila, ["fuente", "Fuente"]);

  if (contieneMujer(fuente)) return fuente;

  return [tipo, fuente].filter(Boolean).join(" ");
}

function primerTexto(fila: Record<string, unknown>, campos: string[]) {
  for (const campo of campos) {
    const value = String(fila[campo] ?? "").trim();

    if (value) return value;
  }

  return "";
}

function numero(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const parsed = Number(
    String(value ?? "").replace(/L\.?/gi, "").replace(/,/g, "").trim()
  );

  return Number.isFinite(parsed) ? parsed : 0;
}

function coincideGrupoMujer(value: string, referencia: string) {
  const texto = normalizarTexto(value);
  const nombreReferencia = normalizarTexto(referencia);

  if (!contieneMujer(texto)) return false;
  if (!nombreReferencia) return true;
  if (texto === nombreReferencia) return true;
  if (texto.includes(nombreReferencia) || nombreReferencia.includes(texto)) {
    return true;
  }

  const tokensReferencia = obtenerTokensSignificativos(nombreReferencia);

  return tokensReferencia.every((token) => texto.includes(token));
}

function contieneMujer(value: string) {
  const texto = normalizarTexto(value);

  return texto.includes("MUJER") || /(^|\s)OMM(?:\s|$)/.test(texto);
}

function obtenerTokensSignificativos(value: string) {
  return normalizarTexto(value)
    .split(/[^A-Z0-9]+/)
    .filter(
      (token) =>
        token.length >= 4 && !["MUNICIPAL", "PARA"].includes(token)
    );
}

function normalizarTexto(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}
