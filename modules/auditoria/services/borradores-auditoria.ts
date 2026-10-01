import { type OrdenAuditoria } from "@/modules/auditoria/domain/auditoria-egresos";
import { type RecomendacionAuditoria } from "@/modules/auditoria/domain/recomendaciones-auditoria";

type EstadoOrden = Readonly<{
  texto: string;
  guardada?: RecomendacionAuditoria;
}>;

type EstadoResumen = {
  totalPendientes: number;
};

const ORDEN_VACIA: EstadoOrden = { texto: "" };

function tieneCambios(estado: EstadoOrden) {
  return estado.texto.trim() !== (estado.guardada?.recomendaciones ?? "");
}

// Se crea por instancia de la página, nunca como estado global entre usuarios.
// Cada editor se suscribe solo a su orden; los indicadores, solo a los contadores.
export function crearBorradoresAuditoria(
  ordenes: Pick<OrdenAuditoria, "noOrden">[],
  recomendaciones: RecomendacionAuditoria[]
) {
  const guardadas = new Map(recomendaciones.map((fila) => [fila.no_orden, fila]));
  const estados = new Map<number, EstadoOrden>();
  const oyentesOrden = new Map<number, Set<() => void>>();
  const oyentesResumen = new Set<() => void>();

  for (const orden of ordenes) {
    const guardada = guardadas.get(orden.noOrden);
    estados.set(orden.noOrden, { texto: guardada?.recomendaciones ?? "", guardada });
  }

  // Las copias iniciales permanecen estables durante SSR e hidratación.
  const iniciales = new Map(estados);
  const resumenInicial: EstadoResumen = { totalPendientes: 0 };
  let resumen = resumenInicial;

  function actualizar(noOrden: number, siguiente: EstadoOrden) {
    const anterior = estados.get(noOrden) ?? ORDEN_VACIA;
    if (anterior.texto === siguiente.texto && anterior.guardada === siguiente.guardada) return;

    const diferenciaPendientes = Number(tieneCambios(siguiente)) - Number(tieneCambios(anterior));
    estados.set(noOrden, siguiente);

    if (diferenciaPendientes) {
      resumen = {
        totalPendientes: resumen.totalPendientes + diferenciaPendientes,
      };
      oyentesResumen.forEach((notificar) => notificar());
    }
    oyentesOrden.get(noOrden)?.forEach((notificar) => notificar());
  }

  return {
    obtenerOrden: (noOrden: number) => estados.get(noOrden) ?? ORDEN_VACIA,
    obtenerOrdenInicial: (noOrden: number) => iniciales.get(noOrden) ?? ORDEN_VACIA,
    obtenerResumen: () => resumen,
    obtenerResumenInicial: () => resumenInicial,
    suscribirOrden(noOrden: number, notificar: () => void) {
      const oyentes = oyentesOrden.get(noOrden) ?? new Set<() => void>();
      oyentes.add(notificar);
      oyentesOrden.set(noOrden, oyentes);
      return () => {
        oyentes.delete(notificar);
        if (!oyentes.size) oyentesOrden.delete(noOrden);
      };
    },
    suscribirResumen(notificar: () => void) {
      oyentesResumen.add(notificar);
      return () => { oyentesResumen.delete(notificar); };
    },
    editar(noOrden: number, texto: string) {
      actualizar(noOrden, { ...(estados.get(noOrden) ?? ORDEN_VACIA), texto });
    },
    registrarGuardada(guardada: RecomendacionAuditoria) {
      const anterior = estados.get(guardada.no_orden) ?? ORDEN_VACIA;
      if ((anterior.guardada?.version ?? 0) > guardada.version) return;
      // Conserva un borrador más reciente o diferente al recuperar un conflicto.
      actualizar(guardada.no_orden, {
        guardada,
        texto: anterior.texto.trim() === guardada.recomendaciones
          ? guardada.recomendaciones : anterior.texto,
      });
    },
  };
}

export type BorradoresAuditoria = ReturnType<typeof crearBorradoresAuditoria>;
