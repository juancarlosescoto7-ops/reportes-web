import { strFromU8, unzipSync } from "fflate";
import {
  normalizarCodigoRubro,
  redondearMoneda,
  type RegistroRecaudacionSaft,
} from "./conversion-ingresos";

const TAMANO_MAXIMO_ARCHIVO = 10 * 1024 * 1024;
const TAMANO_MAXIMO_ENTRADA_XLSX = 12 * 1024 * 1024;
const TAMANO_MAXIMO_XLSX_DESCOMPRIMIDO = 35 * 1024 * 1024;

export type ReporteRecaudacionSaft = {
  nombreArchivo: string;
  hoja: string;
  filaEncabezados: number;
  municipio: string | null;
  periodo: string | null;
  fechaElaboracion: string | null;
  registros: RegistroRecaudacionSaft[];
  total: number;
};

type ValorCelda = string | number | boolean | null;

type HojaXlsx = {
  nombre: string;
  ruta: string;
};

type HojaCandidata = {
  hoja: string;
  filaEncabezados: number;
  municipio: string | null;
  periodo: string | null;
  fechaElaboracion: string | null;
  registros: RegistroRecaudacionSaft[];
};

function parsearXml(xml: string, nombre: string) {
  const documento = new DOMParser().parseFromString(
    xml,
    "application/xml"
  );

  if (documento.getElementsByTagName("parsererror").length > 0) {
    throw new Error(`El archivo contiene XML inválido en ${nombre}.`);
  }

  return documento;
}

function obtenerElementos(documento: Document | Element, nombre: string) {
  return Array.from(documento.getElementsByTagNameNS("*", nombre));
}

function obtenerHijo(elemento: Element, nombre: string) {
  return Array.from(elemento.children).find(
    (hijo) => hijo.localName === nombre
  );
}

function normalizarRutaXlsx(value: string) {
  const partes: string[] = [];

  value
    .replace(/\\/g, "/")
    .split("/")
    .forEach((parte) => {
      if (!parte || parte === ".") return;
      if (parte === "..") {
        partes.pop();
        return;
      }
      partes.push(parte);
    });

  return partes.join("/");
}

function resolverRutaHoja(target: string) {
  const destino = target.replace(/^\/+/, "");

  if (destino.startsWith("xl/")) {
    return normalizarRutaXlsx(destino);
  }

  return normalizarRutaXlsx(`xl/${destino}`);
}

function extraerHojas(
  workbookXml: string,
  relacionesXml: string
): HojaXlsx[] {
  const workbook = parsearXml(workbookXml, "xl/workbook.xml");
  const relaciones = parsearXml(
    relacionesXml,
    "xl/_rels/workbook.xml.rels"
  );
  const rutas = new Map(
    obtenerElementos(relaciones, "Relationship").map((relacion) => [
      relacion.getAttribute("Id") ?? "",
      relacion.getAttribute("Target") ?? "",
    ])
  );

  return obtenerElementos(workbook, "sheet")
    .map((hoja) => {
      const idRelacion =
        hoja.getAttributeNS(
          "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
          "id"
        ) ?? hoja.getAttribute("r:id");
      const target = idRelacion ? rutas.get(idRelacion) : null;

      if (!target) return null;

      return {
        nombre: hoja.getAttribute("name")?.trim() || "Hoja",
        ruta: resolverRutaHoja(target),
      };
    })
    .filter((hoja): hoja is HojaXlsx => Boolean(hoja));
}

function extraerCadenasCompartidas(xml: string | undefined) {
  if (!xml) return [];

  const documento = parsearXml(xml, "xl/sharedStrings.xml");

  return obtenerElementos(documento, "si").map((elemento) =>
    obtenerElementos(elemento, "t")
      .map((texto) => texto.textContent ?? "")
      .join("")
  );
}

function indiceColumna(referencia: string) {
  const letras = referencia.match(/^[A-Za-z]+/)?.[0]?.toUpperCase();

  if (!letras) return -1;

  return Array.from(letras).reduce(
    (resultado, letra) =>
      resultado * 26 + letra.charCodeAt(0) - "A".charCodeAt(0) + 1,
    0
  ) - 1;
}

function leerValorCelda(
  celda: Element,
  cadenasCompartidas: string[]
): ValorCelda {
  const tipo = celda.getAttribute("t") ?? "";

  if (tipo === "inlineStr") {
    return obtenerElementos(celda, "t")
      .map((texto) => texto.textContent ?? "")
      .join("");
  }

  const valorTexto = obtenerHijo(celda, "v")?.textContent ?? "";

  if (tipo === "s") {
    const indice = Number(valorTexto);
    return Number.isInteger(indice) ? cadenasCompartidas[indice] ?? "" : "";
  }

  if (tipo === "b") return valorTexto === "1";
  if (tipo === "str" || tipo === "d" || tipo === "e") return valorTexto;
  if (!valorTexto.trim()) return null;

  const numero = Number(valorTexto);
  return Number.isFinite(numero) ? numero : valorTexto;
}

function extraerFilas(xml: string, cadenasCompartidas: string[]) {
  const documento = parsearXml(xml, "hoja de cálculo");
  const filas = new Map<number, Map<number, ValorCelda>>();

  obtenerElementos(documento, "row").forEach((fila) => {
    const numeroFila = Number(fila.getAttribute("r"));

    if (!Number.isInteger(numeroFila) || numeroFila <= 0) return;

    const celdas = new Map<number, ValorCelda>();

    obtenerElementos(fila, "c").forEach((celda) => {
      const columna = indiceColumna(celda.getAttribute("r") ?? "");

      if (columna < 0) return;
      celdas.set(columna, leerValorCelda(celda, cadenasCompartidas));
    });

    filas.set(numeroFila, celdas);
  });

  return filas;
}

function normalizarEncabezado(value: ValorCelda) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function esEncabezadoCodigo(value: string) {
  return ["cuenta", "codigo", "codigo saft", "rubro"].includes(value);
}

function buscarEncabezados(filas: Map<number, Map<number, ValorCelda>>) {
  for (const [numeroFila, celdas] of filas) {
    let columnaCodigo = -1;
    let columnaDescripcion = -1;
    let columnaValor = -1;

    celdas.forEach((valor, columna) => {
      const encabezado = normalizarEncabezado(valor);

      if (esEncabezadoCodigo(encabezado)) columnaCodigo = columna;
      if (encabezado === "descripcion") columnaDescripcion = columna;
      if (encabezado === "valor recaudado") columnaValor = columna;
    });

    if (columnaCodigo >= 0 && columnaValor >= 0) {
      return {
        numeroFila,
        columnaCodigo,
        columnaDescripcion,
        columnaValor,
      };
    }
  }

  return null;
}

function textoCelda(value: ValorCelda) {
  return String(value ?? "").trim();
}

function esCodigoRubroValido(value: ValorCelda) {
  const codigo = normalizarCodigoRubro(textoCelda(value));
  const cantidadDigitos = codigo.replace(/\D/g, "").length;

  return (
    cantidadDigitos >= 4 &&
    /^[A-Za-z0-9][A-Za-z0-9.\-_/]*$/.test(codigo) &&
    normalizarEncabezado(codigo) !== "totales"
  );
}

function convertirNumero(value: ValorCelda) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  let texto = textoCelda(value)
    .replace(/\s/g, "")
    .replace(/^(HNL|L\.?)/i, "");

  if (!texto) return null;

  const negativo = texto.startsWith("(") && texto.endsWith(")");
  texto = texto.replace(/[()]/g, "");

  const ultimaComa = texto.lastIndexOf(",");
  const ultimoPunto = texto.lastIndexOf(".");

  if (ultimaComa >= 0 && ultimoPunto >= 0) {
    const separadorDecimal = ultimaComa > ultimoPunto ? "," : ".";
    const separadorMiles = separadorDecimal === "," ? "." : ",";
    texto = texto.split(separadorMiles).join("");
    texto = texto.replace(separadorDecimal, ".");
  } else if (ultimaComa >= 0) {
    texto = texto.replace(/\./g, "").replace(",", ".");
  } else {
    texto = texto.replace(/,/g, "");
  }

  const numero = Number(texto);

  if (!Number.isFinite(numero)) return null;
  return negativo ? -numero : numero;
}

function buscarMetadato(
  filas: Map<number, Map<number, ValorCelda>>,
  limiteFila: number,
  etiqueta: string
) {
  for (const [numeroFila, celdas] of filas) {
    if (numeroFila >= limiteFila) break;

    for (const valor of celdas.values()) {
      const texto = textoCelda(valor);

      if (normalizarEncabezado(texto).startsWith(etiqueta)) {
        return texto.includes(":")
          ? texto.slice(texto.indexOf(":") + 1).trim()
          : texto;
      }
    }
  }

  return null;
}

function procesarHoja(
  hoja: HojaXlsx,
  xml: string,
  cadenasCompartidas: string[]
): HojaCandidata | null {
  const filas = extraerFilas(xml, cadenasCompartidas);
  const encabezados = buscarEncabezados(filas);

  if (!encabezados) return null;

  const registros: RegistroRecaudacionSaft[] = [];

  for (const [numeroFila, celdas] of filas) {
    if (numeroFila <= encabezados.numeroFila) continue;

    const codigoValor = celdas.get(encabezados.columnaCodigo) ?? null;
    const valorRecaudado = convertirNumero(
      celdas.get(encabezados.columnaValor) ?? null
    );

    if (!esCodigoRubroValido(codigoValor) || valorRecaudado === null) {
      continue;
    }

    registros.push({
      fila: numeroFila,
      codigo: normalizarCodigoRubro(textoCelda(codigoValor)),
      descripcion:
        encabezados.columnaDescripcion >= 0
          ? textoCelda(celdas.get(encabezados.columnaDescripcion) ?? null)
          : "",
      valorRecaudado: redondearMoneda(valorRecaudado),
    });
  }

  if (registros.length === 0) return null;

  return {
    hoja: hoja.nombre,
    filaEncabezados: encabezados.numeroFila,
    municipio: buscarMetadato(
      filas,
      encabezados.numeroFila,
      "municipio"
    ),
    periodo: buscarMetadato(filas, encabezados.numeroFila, "periodo"),
    fechaElaboracion: buscarMetadato(
      filas,
      encabezados.numeroFila,
      "fecha elaboracion"
    ),
    registros,
  };
}

function validarArchivo(file: File) {
  if (!/\.xlsx$/i.test(file.name)) {
    throw new Error("Seleccione el reporte del cajero en formato .xlsx.");
  }

  if (file.size <= 0) {
    throw new Error("El archivo seleccionado está vacío.");
  }

  if (file.size > TAMANO_MAXIMO_ARCHIVO) {
    throw new Error("El archivo excede el límite permitido de 10 MB.");
  }
}

export async function importarReporteRecaudacionSaft(
  file: File
): Promise<ReporteRecaudacionSaft> {
  validarArchivo(file);

  const bytes = new Uint8Array(await file.arrayBuffer());

  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new Error("El archivo no es un libro XLSX válido.");
  }

  let archivos: Record<string, Uint8Array>;

  try {
    archivos = unzipSync(bytes, {
      filter: (entrada) =>
        entrada.originalSize <= TAMANO_MAXIMO_ENTRADA_XLSX,
    });
  } catch {
    throw new Error(
      "No se pudo abrir el Excel. Verifique que no esté dañado ni protegido con contraseña."
    );
  }

  const tamanoDescomprimido = Object.values(archivos).reduce(
    (total, contenido) => total + contenido.byteLength,
    0
  );

  if (tamanoDescomprimido > TAMANO_MAXIMO_XLSX_DESCOMPRIMIDO) {
    throw new Error("El contenido del Excel excede el límite seguro.");
  }

  const leerXml = (ruta: string, obligatorio = true) => {
    const contenido = archivos[normalizarRutaXlsx(ruta)];

    if (!contenido) {
      if (!obligatorio) return undefined;
      throw new Error(`El Excel no contiene ${ruta}.`);
    }

    return strFromU8(contenido);
  };

  const hojas = extraerHojas(
    leerXml("xl/workbook.xml")!,
    leerXml("xl/_rels/workbook.xml.rels")!
  );
  const cadenasCompartidas = extraerCadenasCompartidas(
    leerXml("xl/sharedStrings.xml", false)
  );
  const candidatas = hojas
    .map((hoja) => {
      const contenido = archivos[hoja.ruta];

      if (!contenido) return null;

      return procesarHoja(hoja, strFromU8(contenido), cadenasCompartidas);
    })
    .filter((hoja): hoja is HojaCandidata => Boolean(hoja))
    .sort((a, b) => b.registros.length - a.registros.length);
  const seleccionada = candidatas[0];

  if (!seleccionada) {
    throw new Error(
      'No se encontraron las columnas "Cuenta" y "Valor Recaudado" ni registros válidos.'
    );
  }

  return {
    nombreArchivo: file.name,
    ...seleccionada,
    total: redondearMoneda(
      seleccionada.registros.reduce(
        (total, registro) => total + registro.valorRecaudado,
        0
      )
    ),
  };
}
