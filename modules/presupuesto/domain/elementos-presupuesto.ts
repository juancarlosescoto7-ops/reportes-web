import type { NivelBorrador, RegistroNivelBorrador, RespuestaBorrador } from "@/modules/presupuesto/services/borradorPresupuesto";

export const NIVELES_ELEMENTO: NivelBorrador[] = ["Programa", "SubPrograma", "Proyecto", "Actividad", "Obra"];
export const NOMBRES_NIVEL: Record<NivelBorrador, string> = {
  Programa: "Programa", SubPrograma: "Subprograma", Proyecto: "Proyecto", Actividad: "Actividad", Obra: "Obra",
};

export type ElementoPresupuesto = { id: string; tipo: "normal" | "sin"; nombre: string };
export type ElementoParaInsertar = ElementoPresupuesto & { nivel: NivelBorrador };
export type ElementoInsertado = { id: string; codigo: string; nombre: string; existente?: boolean };

export const ELEMENTO_SIN: ElementoPresupuesto = { id: "presupuesto-sin", tipo: "sin", nombre: "SIN…" };

export function nivelHijo(padre: NivelBorrador | null): NivelBorrador | null {
  return NIVELES_ELEMENTO[padre === null ? 0 : NIVELES_ELEMENTO.indexOf(padre) + 1] ?? null;
}

export function nombreEsSin(nombre: string) {
  return /^sin(?:[.…]+|\s+(?:programa|sub\s*programa|proyecto|actividad|obra))?$/i.test(nombre.trim());
}

export function nombreEnDestino(pieza: ElementoPresupuesto, nivel: NivelBorrador) {
  return pieza.tipo === "sin" ? `SIN ${NOMBRES_NIVEL[nivel].toLocaleUpperCase("es")}` : pieza.nombre.trim();
}

export function siguienteNumero(fragmentos: string[]) {
  let ultimo = 0;
  for (const fragmento of fragmentos) {
    if (!/^\d+$/.test(fragmento.trim())) continue;
    const numero = Number(fragmento);
    if (!Number.isSafeInteger(numero)) throw new Error("La numeración de este padre supera el rango permitido.");
    ultimo = Math.max(ultimo, numero);
  }
  if (!Number.isSafeInteger(ultimo + 1)) throw new Error("No se puede asignar otro número a este padre.");
  return String(ultimo + 1);
}

function siguienteCodigoPrograma(data: RespuestaBorrador) {
  const reservados = new Set(data.topes
    .filter((tope) => tope.nivel_aplicacion === "programa" && /^\d+$/.test(tope.id_nivel.trim()))
    .map((tope) => Number(tope.id_nivel)));
  const ocupados = new Set(data.programas
    .filter((programa) => /^\d+$/.test(programa.codigo.trim()))
    .map((programa) => Number(programa.codigo)));
  const ordinarios = data.programas
    .filter((programa) => !reservados.has(Number(programa.codigo)))
    .map((programa) => programa.codigo);
  let numero = Number(siguienteNumero(ordinarios));
  while (reservados.has(numero) || ocupados.has(numero)) {
    if (!Number.isSafeInteger(numero + 1)) throw new Error("No se puede asignar otro programa.");
    numero += 1;
  }
  return String(numero).padStart(2, "0");
}

export function prepararElemento(data: RespuestaBorrador, pieza: ElementoParaInsertar, parentId?: string) {
  const rows: Record<NivelBorrador, RegistroNivelBorrador[]> = {
    Programa: data.programas, SubPrograma: data.subprogramas, Proyecto: data.proyectos,
    Actividad: data.actividades, Obra: data.obras,
  };
  const parentField: Partial<Record<NivelBorrador, keyof RegistroNivelBorrador>> = {
    SubPrograma: "programa_id", Proyecto: "subprograma_id", Actividad: "proyecto_id", Obra: "actividad_id",
  };
  const parentLevel = NIVELES_ELEMENTO[NIVELES_ELEMENTO.indexOf(pieza.nivel) - 1];
  const parent = parentLevel ? rows[parentLevel].find((row) => row.id === parentId) : null;
  if (parentLevel && !parent) throw new Error("El padre ya no está disponible. Recarga el borrador.");
  const field = parentField[pieza.nivel];
  const siblings = field ? rows[pieza.nivel].filter((row) => row[field] === parentId) : rows[pieza.nivel];
  const fragmentOf = (row: RegistroNivelBorrador) => (row.fragmento ?? (parent ? row.codigo.slice(parent.codigo.length) : row.codigo)).trim();
  const fragmento = pieza.tipo === "sin" ? "0" : pieza.nivel === "Programa"
    ? siguienteCodigoPrograma(data) : siguienteNumero(siblings.map(fragmentOf));
  const codigo = parent ? `${parent.codigo} ${fragmento}` : fragmento;
  const nombre = nombreEnDestino(pieza, pieza.nivel);
  const existente = siblings.find((row) => fragmentOf(row) === fragmento);
  if (existente && (pieza.tipo !== "sin" || !nombreEsSin(existente.nombre))) {
    throw new Error(`El código ${fragmento} ya está ocupado bajo este padre por «${existente.nombre}».`);
  }
  return { fragmento, codigo, nombre, existente };
}

// Las piezas de la primera versión conservan su nombre, pero ya no fijan nivel ni código.
export function recuperarElementos(stored: unknown): ElementoPresupuesto[] {
  if (!Array.isArray(stored)) return [];
  const nombres = new Set<string>();
  const ids = new Set<string>();
  const result: ElementoPresupuesto[] = [];
  for (const value of stored) {
    if (!value || typeof value !== "object") continue;
    const row = value as Record<string, unknown>;
    if (typeof row.id !== "string" || !row.id || typeof row.nombre !== "string" || !row.nombre.trim()) continue;
    const nombre = row.nombre.trim();
    const normalized = nombre.toLocaleLowerCase("es");
    if (row.tipo === "sin" || row.id === ELEMENTO_SIN.id || nombreEsSin(nombre) || nombres.has(normalized) || ids.has(row.id)) continue;
    nombres.add(normalized);
    ids.add(row.id);
    result.push({ id: row.id, tipo: "normal", nombre });
  }
  return result;
}
