export type ContextoCodigoPresupuesto = {
  codigo: string;
  contexto_cxp: string | null;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

export function combinarContextosConPresupuesto(
  presupuesto: Record<string, unknown>[],
  contextos: ContextoCodigoPresupuesto[]
) {
  const contextoPorCodigo = new Map(
    contextos
      .map((item) => [clean(item.codigo), clean(item.contexto_cxp) || null] as const)
      .filter(([codigo]) => Boolean(codigo))
  );

  return presupuesto.map((row) => {
    const codigo = clean(row.codigo ?? row.codigo_presupuestario);

    return {
      ...row,
      contexto_cxp: contextoPorCodigo.get(codigo) ?? null,
    };
  });
}
