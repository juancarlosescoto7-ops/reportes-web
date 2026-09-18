import type { ControlTopeBorrador, RegistroNivelBorrador, RespuestaBorrador } from "@/modules/presupuesto/services/borradorPresupuesto";

export const FUENTE_PROPIOS = "15-013-01";
export const FUENTE_TRANSFERENCIAS = "11-001-01";

export type NodoPresentacion = {
  id: string;
  codigo: string;
  nombre: string;
  nivel: string;
  hijos: NodoPresentacion[];
};

export function numeroPresupuesto(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numero = Number(value);
  return Number.isFinite(numero) && numero >= 0 ? numero : null;
}

const ordenar = (a: { codigo: string }, b: { codigo: string }) => a.codigo.localeCompare(b.codigo, "es", { numeric: true });
const codigoPrograma = (codigo: string) => /^\d+$/.test(codigo.trim()) ? String(Number(codigo)) : codigo.trim();
const sumar = (valores: (number | null)[]) => valores.some((valor) => valor === null) ? null : valores.reduce<number>((total, valor) => total + Math.round(valor! * 100), 0) / 100;

export function construirPresentacionBorrador(data: RespuestaBorrador) {
  const nombresRubros = new Map(data.rubrosIngresos.map((rubro) => [rubro.codigo, rubro.descripcion]));
  const ingresos = data.ingresos.map((ingreso) => ({
    codigo: ingreso.codigo_saft,
    nombre: nombresRubros.get(ingreso.codigo_saft) ?? "Rubro sin nombre en el catálogo",
    monto: numeroPresupuesto(ingreso.presupuesto_proyectado),
  })).sort(ordenar);
  const propios = ingresos.length ? sumar(ingresos.map((ingreso) => ingreso.monto)) : null;
  const fuenteTransferencias = data.fuentes.find((fuente) => fuente.fuente === FUENTE_TRANSFERENCIAS);
  const transferencias = numeroPresupuesto(fuenteTransferencias?.monto_base);
  const proyectados = new Set(ingresos.map((ingreso) => ingreso.codigo));
  const sinProyeccion = data.rubrosIngresos.filter((rubro) => !proyectados.has(rubro.codigo)).length;

  const programas: NodoPresentacion[] = data.programas.map((row) => ({ id: row.id, codigo: row.codigo, nombre: row.nombre, nivel: "Programa", hijos: [] }));
  const nodos = new Map(programas.map((nodo) => [nodo.id, nodo]));
  let ramasSinPadre = 0;
  const agregar = (rows: RegistroNivelBorrador[], campoPadre: keyof RegistroNivelBorrador, nivel: string) => {
    for (const row of rows) {
      const padre = nodos.get(String(row[campoPadre]));
      if (!padre) { ramasSinPadre++; continue; }
      const nodo = { id: row.id, codigo: row.codigo, nombre: row.nombre, nivel, hijos: [] };
      nodos.set(row.id, nodo);
      padre.hijos.push(nodo);
    }
  };
  agregar(data.subprogramas, "programa_id", "Subprograma");
  agregar(data.proyectos, "subprograma_id", "Proyecto");
  agregar(data.actividades, "proyecto_id", "Actividad");
  agregar(data.obras, "actividad_id", "Obra");
  const objetos = new Map(data.objetosGasto.map((objeto) => [objeto.id, objeto.nombre]));
  for (const row of data.codigos) {
    const padre = nodos.get(row.obra_id);
    if (!padre) { ramasSinPadre++; continue; }
    padre.hijos.push({ id: row.id, codigo: row.codigo, nombre: objetos.get(row.objeto) ?? `Objeto del gasto ${row.objeto}`, nivel: "Objeto del gasto", hijos: [] });
  }
  for (const nodo of nodos.values()) nodo.hijos.sort(ordenar);
  programas.sort(ordenar);

  const techo = (fuente: string, nivel: string, id: string): ControlTopeBorrador | null => data.controlTechos.find((row) =>
    row.fuente === fuente && row.nivel_aplicacion === nivel && codigoPrograma(row.id_nivel) === codigoPrograma(id)
  ) ?? null;
  const funcionamiento = programas.filter((programa) => Number(programa.codigo) >= 1 && Number(programa.codigo) <= 6);
  const inversion = programas.filter((programa) => Number(programa.codigo) >= 11 && Number(programa.codigo) <= 16);
  const otros = programas.filter((programa) => !funcionamiento.includes(programa) && !inversion.includes(programa));
  return {
    ingresos, propios, transferencias, sinProyeccion,
    total: sumar([propios, transferencias]),
    funcionamiento, inversion, otros, ramasSinPadre,
    tieneAsignaciones: data.codigos.some((row) => (numeroPresupuesto(row.monto) ?? 0) > 0),
    techosFuncionamiento: [
      { titulo: "Funcionamiento · Transferencias", fuente: FUENTE_TRANSFERENCIAS, base: transferencias, techo: techo(FUENTE_TRANSFERENCIAS, "tipo_inversion", "10") },
      { titulo: "Funcionamiento · Fondos propios", fuente: FUENTE_PROPIOS, base: propios, techo: techo(FUENTE_PROPIOS, "tipo_inversion", "10") },
    ],
    techoInversionPropios: { titulo: "Inversión · Fondos propios", fuente: FUENTE_PROPIOS, base: propios, techo: techo(FUENTE_PROPIOS, "tipo_inversion", "20") },
    techosPrograma: new Map(programas.map((programa) => [programa.id, techo(FUENTE_TRANSFERENCIAS, "programa", programa.codigo)])),
    otrasFuentes: data.fuentes.filter((fuente) => ![FUENTE_PROPIOS, FUENTE_TRANSFERENCIAS].includes(fuente.fuente)),
  };
}

export type PresentacionBorrador = ReturnType<typeof construirPresentacionBorrador>;
