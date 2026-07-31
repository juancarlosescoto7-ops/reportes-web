import type {
  CatalogosConversionIngresos,
  EquivalenciaRubroIngreso,
  RubroIngresoSaft,
  RubroIngresoSami,
} from "@/lib/conversion-ingresos";
import { crearClienteSupabase } from "@/lib/supabase";

type FilaErrorSupabase = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

function crearErrorCatalogo(
  tabla: string,
  error: FilaErrorSupabase
) {
  const texto = [error.message, error.details, error.hint]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ");
  const tablaNoInstalada =
    error.code === "PGRST205" ||
    /schema cache|could not find the table|no se.*tabla/i.test(texto);

  if (tablaNoInstalada) {
    return new Error(
      `No se encontró la tabla ${tabla} en Supabase. Ejecute sql/arqueos_conversion_sami.sql antes de usar el conversor.`
    );
  }

  return new Error(
    `No se pudo cargar ${tabla}.${texto ? ` ${texto}` : ""}`
  );
}

async function obtenerTablaCatalogo<T>(
  tabla: string,
  columnas: string,
  columnaOrden: string
): Promise<T[]> {
  const supabase = crearClienteSupabase();
  const limite = 1_000;
  const filas: T[] = [];

  for (let pagina = 0; pagina < 20; pagina += 1) {
    const desde = pagina * limite;
    const { data, error } = await supabase
      .from(tabla)
      .select(columnas)
      .order(columnaOrden, { ascending: true })
      .range(desde, desde + limite - 1);

    if (error) {
      throw crearErrorCatalogo(tabla, error);
    }

    if (!Array.isArray(data)) {
      throw new Error(`${tabla} devolvió un formato inesperado.`);
    }

    filas.push(...(data as unknown as T[]));

    if (data.length < limite) {
      return filas;
    }
  }

  throw new Error(
    `${tabla} supera el límite seguro de 20,000 registros.`
  );
}

export async function obtenerCatalogosConversorSamiSaft(): Promise<CatalogosConversionIngresos> {
  const [rubrosSami, rubrosSaft, equivalencias] = await Promise.all([
    obtenerTablaCatalogo<RubroIngresoSami>(
      "rubros_ingresos_sami",
      "codigo,descripcion",
      "codigo"
    ),
    obtenerTablaCatalogo<RubroIngresoSaft>(
      "rubros_ingresos_saft",
      "codigo,descripcion",
      "codigo"
    ),
    obtenerTablaCatalogo<EquivalenciaRubroIngreso>(
      "equivalencias_rubros_ingresos",
      "codigo_saft,codigo_sami",
      "codigo_saft"
    ),
  ]);

  if (
    rubrosSami.length === 0 ||
    rubrosSaft.length === 0 ||
    equivalencias.length === 0
  ) {
    throw new Error(
      "Los catálogos SAMI, SAFT y sus equivalencias deben contener datos antes de usar el conversor."
    );
  }

  return {
    rubrosSami,
    rubrosSaft,
    equivalencias,
  };
}
