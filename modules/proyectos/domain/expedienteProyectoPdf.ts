export type RequisitoExpedientePdf = {
  id: number;
  nombre: string;
  url: string | null;
};

export type OrdenPagoExpedientePdf = {
  id: string;
  nombre: string;
  url: string | null;
};

export type ArchivoExpedientePdf = {
  clave: string;
  nombre: string;
  url: string;
  tipo: "requisito" | "orden_pago";
};

type RequisitoOrdenable = Omit<ArchivoExpedientePdf, "url"> & {
  url: string | null;
};

function normalizarTexto(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function requisitosUnicos(
  requisitos: RequisitoExpedientePdf[]
): RequisitoOrdenable[] {
  const unicos = new Map<string, RequisitoOrdenable>();

  requisitos.forEach((requisito) => {
    const clave = `requisito:${requisito.id}`;
    const url = requisito.url?.trim() || null;
    const actual = unicos.get(clave);

    if (!actual || (!actual.url && url)) {
      unicos.set(clave, {
        clave,
        nombre: requisito.nombre.trim() || `Requisito ${requisito.id}`,
        url,
        tipo: "requisito",
      });
    }
  });

  return Array.from(unicos.values());
}

function ordenesUnicas(
  ordenes: OrdenPagoExpedientePdf[]
): ArchivoExpedientePdf[] {
  const unicas = new Map<string, ArchivoExpedientePdf>();

  ordenes.forEach((orden) => {
    const url = orden.url?.trim();
    const id = orden.id.trim();

    if (!url || !id) return;

    const clave = `orden_pago:${id}`;

    if (!unicas.has(clave)) {
      unicas.set(clave, {
        clave,
        nombre: orden.nombre.trim() || `Orden de pago #${id}`,
        url,
        tipo: "orden_pago",
      });
    }
  });

  return Array.from(unicas.values()).sort((a, b) =>
    a.clave.localeCompare(b.clave, "es", {
      numeric: true,
      sensitivity: "base",
    })
  );
}

export function ordenarArchivosExpediente(params: {
  requisitos: RequisitoExpedientePdf[];
  ordenes: OrdenPagoExpedientePdf[];
}) {
  const requisitos = requisitosUnicos(params.requisitos);
  const ordenes = ordenesUnicas(params.ordenes);
  const resultado: ArchivoExpedientePdf[] = [];
  let ordenesInsertadas = false;

  requisitos.forEach((requisito) => {
    if (requisito.url) {
      resultado.push({ ...requisito, url: requisito.url });
    }

    const nombre = normalizarTexto(requisito.nombre);

    if (
      !ordenesInsertadas &&
      (nombre === "ejecucion" || nombre.includes("ejecucion"))
    ) {
      resultado.push(...ordenes);
      ordenesInsertadas = true;
    }
  });

  if (!ordenesInsertadas) {
    resultado.push(...ordenes);
  }

  return resultado;
}
