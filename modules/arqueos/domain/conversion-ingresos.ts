export type RubroIngresoSami = {
  codigo: string;
  descripcion: string;
};

export type RubroIngresoSaft = {
  codigo: string;
  descripcion: string;
};

export type EquivalenciaRubroIngreso = {
  codigo_saft: string;
  codigo_sami: string;
};

export type CatalogosConversionIngresos = {
  rubrosSami: RubroIngresoSami[];
  rubrosSaft: RubroIngresoSaft[];
  equivalencias: EquivalenciaRubroIngreso[];
};

export type RegistroRecaudacionSaft = {
  fila: number;
  codigo: string;
  descripcion: string;
  valorRecaudado: number;
};

export type RegistroRecaudacionConvertido = RegistroRecaudacionSaft & {
  codigoSami: string | null;
  descripcionSami: string | null;
};

export type RubroSaftSinEquivalencia = {
  codigo: string;
  descripcion: string;
  valorRecaudado: number;
};

export type DetalleConversionSami = {
  codigo: string;
  descripcion: string;
  valorRecaudado: number;
  codigosSaft: string[];
  cantidadRegistros: number;
};

export type ResultadoConversionIngresos = {
  registros: RegistroRecaudacionConvertido[];
  detallesSami: DetalleConversionSami[];
  sinEquivalencia: RubroSaftSinEquivalencia[];
  totalSaft: number;
  totalSami: number;
  totalSinEquivalencia: number;
};

export function normalizarCodigoRubro(value: string | number) {
  const codigo = String(value ?? "")
    .trim()
    .replace(/^'+/, "")
    .replace(/\s+/g, "");

  return codigo.replace(/\.0+$/, "");
}

export function redondearMoneda(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function convertirACentavos(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100);
}

export function montosCuadran(
  totalConversion: number,
  totalDepositos: number
) {
  return (
    convertirACentavos(totalConversion) === convertirACentavos(totalDepositos)
  );
}

export function calcularDiferenciaArqueo(
  totalConversion: number,
  totalDepositos: number
) {
  return redondearMoneda(totalDepositos - totalConversion);
}

export function convertirRegistrosSaftASami(
  registros: RegistroRecaudacionSaft[],
  catalogos: CatalogosConversionIngresos
): ResultadoConversionIngresos {
  const rubrosSami = new Map(
    catalogos.rubrosSami.map((rubro) => [
      normalizarCodigoRubro(rubro.codigo),
      rubro,
    ])
  );
  const rubrosSaft = new Map(
    catalogos.rubrosSaft.map((rubro) => [
      normalizarCodigoRubro(rubro.codigo),
      rubro,
    ])
  );
  const equivalencias = new Map(
    catalogos.equivalencias.map((equivalencia) => [
      normalizarCodigoRubro(equivalencia.codigo_saft),
      normalizarCodigoRubro(equivalencia.codigo_sami),
    ])
  );
  const agrupadosSami = new Map<
    string,
    {
      codigo: string;
      descripcion: string;
      centavos: number;
      codigosSaft: Set<string>;
      cantidadRegistros: number;
    }
  >();
  const faltantes = new Map<
    string,
    {
      codigo: string;
      descripcion: string;
      centavos: number;
    }
  >();
  let totalSaftCentavos = 0;
  let totalSamiCentavos = 0;

  const registrosConvertidos = registros.map((registro) => {
    const codigoSaft = normalizarCodigoRubro(registro.codigo);
    const centavos = convertirACentavos(registro.valorRecaudado);
    const codigoSamiNormalizado = equivalencias.get(codigoSaft);
    const rubroSami = codigoSamiNormalizado
      ? rubrosSami.get(codigoSamiNormalizado)
      : undefined;
    const descripcionSaft =
      registro.descripcion.trim() ||
      rubrosSaft.get(codigoSaft)?.descripcion.trim() ||
      "Sin descripción SAFT";

    totalSaftCentavos += centavos;

    if (!codigoSamiNormalizado || !rubroSami) {
      const existente = faltantes.get(codigoSaft);

      if (existente) {
        existente.centavos += centavos;
      } else {
        faltantes.set(codigoSaft, {
          codigo: codigoSaft,
          descripcion: descripcionSaft,
          centavos,
        });
      }

      return {
        ...registro,
        codigo: codigoSaft,
        descripcion: descripcionSaft,
        codigoSami: null,
        descripcionSami: null,
      };
    }

    const codigoSami = normalizarCodigoRubro(rubroSami.codigo);
    const existente = agrupadosSami.get(codigoSami);

    if (existente) {
      existente.centavos += centavos;
      existente.codigosSaft.add(codigoSaft);
      existente.cantidadRegistros += 1;
    } else {
      agrupadosSami.set(codigoSami, {
        codigo: codigoSami,
        descripcion: rubroSami.descripcion.trim(),
        centavos,
        codigosSaft: new Set([codigoSaft]),
        cantidadRegistros: 1,
      });
    }

    totalSamiCentavos += centavos;

    return {
      ...registro,
      codigo: codigoSaft,
      descripcion: descripcionSaft,
      codigoSami,
      descripcionSami: rubroSami.descripcion.trim(),
    };
  });

  const detallesSami = Array.from(agrupadosSami.values())
    .map((detalle) => ({
      codigo: detalle.codigo,
      descripcion: detalle.descripcion,
      valorRecaudado: detalle.centavos / 100,
      codigosSaft: Array.from(detalle.codigosSaft).sort((a, b) =>
        a.localeCompare(b, "es-HN", { numeric: true })
      ),
      cantidadRegistros: detalle.cantidadRegistros,
    }))
    .sort((a, b) =>
      a.codigo.localeCompare(b.codigo, "es-HN", { numeric: true })
    );

  const sinEquivalencia = Array.from(faltantes.values())
    .map((rubro) => ({
      codigo: rubro.codigo,
      descripcion: rubro.descripcion,
      valorRecaudado: rubro.centavos / 100,
    }))
    .sort((a, b) =>
      a.codigo.localeCompare(b.codigo, "es-HN", { numeric: true })
    );

  return {
    registros: registrosConvertidos,
    detallesSami,
    sinEquivalencia,
    totalSaft: totalSaftCentavos / 100,
    totalSami: totalSamiCentavos / 100,
    totalSinEquivalencia:
      (totalSaftCentavos - totalSamiCentavos) / 100,
  };
}
