export { puedeEditarDatos } from "./acceso-editor-datos.mjs";

export type TipoColumna = "text" | "uuid" | "numeric" | "int8" | "int4" | "date" | "timestamp" | "timestamptz";
export type Columna = { nombre: string; tipo: TipoColumna; nullable: boolean };
export type Tabla = { nombre: string; titulo: string; columnas: Columna[] };
export type Fila = Record<string, string | null>;
export type Filtro = { columna: string; operador: "valores" | "contiene" | "eq" | "neq" | "gte" | "lte" | "entre" | "nulo" | "no_nulo"; valor?: string; hasta?: string; valores?: (string | null)[] };

const columnas = (definicion: string): Columna[] => definicion.split(" ").map((campo) => {
  const [nombre, tipo = "text"] = campo.replace("!", "").split(":");
  return { nombre, tipo: tipo as TipoColumna, nullable: !campo.includes("!") };
});
const ejecucion = "codigo_presupuestario! actividad_id proyecto_id monto_ejecutado:numeric! fecha_ejecucion:date! ejercicio_fiscal:int4! usuario_registro! fecha_registro:timestamptz!";

// Nombres, orden, tipos y nulabilidad contrastados con information_schema de Supabase.
export const TABLAS: Tabla[] = [
  { nombre: "cuentas_por_pagar", titulo: "Cuentas por Pagar", columnas: columnas("id:int8! fecha:date descripcion debe:numeric haber:numeric no_cxp:int8 id_beneficiario tipo_movimiento cuenta estado motivo_anulacion usuario_anulacion fecha_anulacion:timestamptz fecha_pago:date no_orden_pago:int8") },
  { nombre: "compromisos_presupuestarios", titulo: "Compromisos Presupuestarios", columnas: columnas(`id:uuid! cxp_id:int8! ${ejecucion} tipo_compromiso`) },
  { nombre: "egresos", titulo: "Egresos", columnas: columnas("id:int8! fecha:date descripcion debe:numeric haber:numeric no_orden:int8 id_beneficiario no_cheque:int8 tipo_movimiento cuenta estado origen usuario_registro fecha_registro:timestamptz") },
  { nombre: "ejecuciones_presupuestarias", titulo: "Ejecuciones Presupuestarias", columnas: columnas(`id:uuid! orden_pago_id:int8! ${ejecucion}`) },
  { nombre: "ingresos", titulo: "Ingresos", columnas: columnas("id:uuid! fecha:date! monto:numeric! tipo_ingreso! cuenta! id_arqueo:uuid! created_at:timestamp fecha_deposito:date") },
  { nombre: "arqueos", titulo: "Arqueos", columnas: columnas("id:uuid! fecha:date! total:numeric! descripcion created_at:timestamp numero_arqueo:int8! caja_sesion_id:uuid total_efectivo:numeric total_transferencias:numeric total_cobrado:numeric efectivo_esperado:numeric efectivo_declarado:numeric diferencia:numeric estado justificacion confirmado_en:timestamptz updated_at:timestamptz") },
  { nombre: "beneficiarios", titulo: "Beneficiarios", columnas: columnas("id! nombre") },
];

export function obtenerTabla(nombre: unknown): Tabla {
  const tabla = TABLAS.find((item) => item.nombre === nombre);
  if (!tabla) throw new Error("Tabla no permitida.");
  return tabla;
}

export function obtenerColumna(tabla: Tabla, nombre: unknown): Columna {
  const columna = tabla.columnas.find((item) => item.nombre === nombre);
  if (!columna) throw new Error("Columna no permitida.");
  return columna;
}

export const esNumero = (columna: Columna) => ["numeric", "int8", "int4"].includes(columna.tipo);
export const seleccion = (columnas: Columna[]) => columnas.map((c) => esNumero(c) ? `${c.nombre}::text` : c.nombre).join(",");
export const mostrarValor = (valor: string | null) => valor === null ? "NULL" : valor === "" ? '""' : valor;

export function validarValor(columna: Columna, valor: unknown): string | null {
  if (valor === null && columna.nullable) return null;
  if (typeof valor !== "string" || valor.length > 100_000) throw new Error(`${columna.nombre}: valor inválido.`);
  if (esNumero(columna)) {
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(valor)) throw new Error(`${columna.nombre}: escriba un número válido con punto decimal.`);
    if (columna.tipo !== "numeric") {
      if (!/^[+-]?\d+$/.test(valor)) throw new Error(`${columna.nombre}: debe ser un entero.`);
      const numero = BigInt(valor);
      const limite = columna.tipo === "int4" ? BigInt("2147483648") : BigInt("9223372036854775808");
      if (numero < -limite || numero >= limite) throw new Error(`${columna.nombre}: entero fuera de rango.`);
    }
  }
  if (columna.tipo === "uuid" && !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(valor)) throw new Error(`${columna.nombre}: UUID inválido.`);
  if (columna.tipo === "date" && (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || !Number.isFinite(Date.parse(valor)) || new Date(valor).toISOString().slice(0, 10) !== valor)) throw new Error(`${columna.nombre}: fecha inválida.`);
  if (columna.tipo.startsWith("timestamp") && (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(valor) || !Number.isFinite(Date.parse(valor)))) throw new Error(`${columna.nombre}: fecha y hora inválidas.`);
  return valor;
}

function literal(valor: string) { return `"${valor.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`; }

export function agregarFiltros(params: URLSearchParams, tabla: Tabla, entrada: unknown): Filtro[] {
  if (!Array.isArray(entrada) || entrada.length > tabla.columnas.length) throw new Error("Filtros inválidos.");
  const usadas = new Set<string>();
  for (const filtro of entrada as Filtro[]) {
    if (!filtro || typeof filtro !== "object") throw new Error("Filtro inválido.");
    const col = obtenerColumna(tabla, filtro.columna);
    if (usadas.has(col.nombre)) throw new Error("Una columna tiene filtros duplicados.");
    usadas.add(col.nombre);
    if (filtro.operador === "nulo" || filtro.operador === "no_nulo") {
      params.append(col.nombre, filtro.operador === "nulo" ? "is.null" : "not.is.null");
    } else if (filtro.operador === "valores") {
      if (!Array.isArray(filtro.valores) || filtro.valores.length === 0 || filtro.valores.length > 500) throw new Error("Seleccione entre 1 y 500 valores.");
      const valores = filtro.valores.map((v) => v === null ? null : validarValor(col, v));
      const noNulos = valores.filter((v): v is string => v !== null);
      const condicion = `in.(${noNulos.map(literal).join(",")})`;
      if (valores.includes(null) && noNulos.length) params.append("or", `(${col.nombre}.is.null,${col.nombre}.${condicion})`);
      else params.append(col.nombre, noNulos.length ? condicion : "is.null");
    } else if (filtro.operador === "contiene") {
      if (col.tipo !== "text" || typeof filtro.valor !== "string" || filtro.valor.length > 500) throw new Error("Filtro de texto inválido.");
      params.append(col.nombre, `ilike.%${filtro.valor.replace(/[\\%_*]/g, "\\$&")}%`);
    } else if (["eq", "neq", "gte", "lte", "entre"].includes(filtro.operador)) {
      const valor = validarValor(col, filtro.valor);
      if (filtro.operador === "entre") {
        params.append(col.nombre, `gte.${valor}`);
        params.append(col.nombre, `lte.${validarValor(col, filtro.hasta)}`);
      } else params.append(col.nombre, `${filtro.operador}.${valor}`);
    } else throw new Error("Operador no permitido.");
  }
  return entrada as Filtro[];
}

export function prepararCambio(tabla: Tabla, entrada: unknown) {
  if (!entrada || typeof entrada !== "object") throw new Error("Cambio inválido.");
  const { original, cambios } = entrada as { original: Fila; cambios: Fila };
  if (!original || !cambios || Array.isArray(cambios) || typeof cambios !== "object" || Array.isArray(original)) throw new Error("Cambio inválido.");
  const params = new URLSearchParams({ select: seleccion(tabla.columnas) });
  // Comparación atómica de la fila completa: detecta ediciones simultáneas y eliminaciones.
  for (const col of tabla.columnas) {
    const valor = validarValor(col, original[col.nombre]);
    params.append(col.nombre, valor === null ? "is.null" : `eq.${valor}`);
  }
  const payload: Fila = {};
  for (const [nombre, valor] of Object.entries(cambios)) {
    const col = obtenerColumna(tabla, nombre);
    if (nombre === "id") throw new Error("La clave primaria no se puede editar.");
    payload[nombre] = validarValor(col, valor);
  }
  if (!Object.keys(payload).length) throw new Error("No hay cambios para guardar.");
  return { params, payload };
}
