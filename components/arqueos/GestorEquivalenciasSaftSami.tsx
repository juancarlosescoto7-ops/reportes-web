"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Link2,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
} from "lucide-react";

import {
  normalizarCodigoRubro,
  type CatalogosConversionIngresos,
  type RubroSaftSinEquivalencia,
} from "@/lib/conversion-ingresos";
import {
  guardarEquivalenciaRubroIngreso,
  obtenerCatalogosConversorSamiSaft,
} from "@/services/conversor-sami-saft.service";

type SeleccionEquivalencia = {
  codigo: string;
  descripcion: string;
};

type Props = {
  catalogos: CatalogosConversionIngresos;
  pendientes?: RubroSaftSinEquivalencia[];
  seleccionSolicitada?: SeleccionEquivalencia | null;
  onCatalogosActualizados: (
    catalogos: CatalogosConversionIngresos
  ) => void;
};

export default function GestorEquivalenciasSaftSami({
  catalogos,
  pendientes = [],
  seleccionSolicitada = null,
  onCatalogosActualizados,
}: Props) {
  const [codigoSaft, setCodigoSaft] = useState("");
  const [descripcionSaft, setDescripcionSaft] = useState("");
  const [codigoSami, setCodigoSami] = useState("");
  const [busquedaSami, setBusquedaSami] = useState("");
  const [busquedaEquivalencia, setBusquedaEquivalencia] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const rubrosSaft = useMemo(
    () =>
      new Map(
        catalogos.rubrosSaft.map((rubro) => [
          normalizarCodigoRubro(rubro.codigo),
          rubro,
        ])
      ),
    [catalogos.rubrosSaft]
  );
  const equivalencias = useMemo(
    () =>
      new Map(
        catalogos.equivalencias.map((equivalencia) => [
          normalizarCodigoRubro(equivalencia.codigo_saft),
          normalizarCodigoRubro(equivalencia.codigo_sami),
        ])
      ),
    [catalogos.equivalencias]
  );

  const cuentasSamiFiltradas = useMemo(() => {
    const termino = busquedaSami.toLocaleLowerCase("es-HN").trim();
    const cuentas = termino
      ? catalogos.rubrosSami.filter((rubro) =>
          `${rubro.codigo} ${rubro.descripcion}`
            .toLocaleLowerCase("es-HN")
            .includes(termino)
        )
      : catalogos.rubrosSami;

    return cuentas.slice(0, 300);
  }, [busquedaSami, catalogos.rubrosSami]);

  const equivalenciasFiltradas = useMemo(() => {
    const rubrosSami = new Map(
      catalogos.rubrosSami.map((rubro) => [
        normalizarCodigoRubro(rubro.codigo),
        rubro,
      ])
    );
    const termino = busquedaEquivalencia
      .toLocaleLowerCase("es-HN")
      .trim();

    return catalogos.equivalencias
      .map((equivalencia) => {
        const saft = rubrosSaft.get(
          normalizarCodigoRubro(equivalencia.codigo_saft)
        );
        const sami = rubrosSami.get(
          normalizarCodigoRubro(equivalencia.codigo_sami)
        );

        return {
          codigoSaft: equivalencia.codigo_saft,
          descripcionSaft: saft?.descripcion ?? "Sin descripción SAFT",
          codigoSami: equivalencia.codigo_sami,
          descripcionSami: sami?.descripcion ?? "Sin descripción SAMI",
        };
      })
      .filter((equivalencia) =>
        termino
          ? `${equivalencia.codigoSaft} ${equivalencia.descripcionSaft} ${equivalencia.codigoSami} ${equivalencia.descripcionSami}`
              .toLocaleLowerCase("es-HN")
              .includes(termino)
          : true
      )
      .slice(0, 300);
  }, [busquedaEquivalencia, catalogos.equivalencias, catalogos.rubrosSami, rubrosSaft]);

  function seleccionarCodigo(codigo: string, descripcion?: string) {
    const normalizado = normalizarCodigoRubro(codigo);
    const rubroExistente = rubrosSaft.get(normalizado);

    setCodigoSaft(normalizado);
    setDescripcionSaft(
      descripcion?.trim() || rubroExistente?.descripcion.trim() || ""
    );
    setCodigoSami(equivalencias.get(normalizado) ?? "");
    setBusquedaSami("");
    setError("");
    setMensaje("");
  }

  useEffect(() => {
    if (seleccionSolicitada) {
      seleccionarCodigo(
        seleccionSolicitada.codigo,
        seleccionSolicitada.descripcion
      );
    }
    // La selección externa representa una acción explícita del usuario.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seleccionSolicitada]);

  function nuevaEquivalencia() {
    setCodigoSaft("");
    setDescripcionSaft("");
    setCodigoSami("");
    setBusquedaSami("");
    setError("");
    setMensaje("");
  }

  async function guardar() {
    const codigoSaftNormalizado = normalizarCodigoRubro(codigoSaft);
    const codigoSamiNormalizado = normalizarCodigoRubro(codigoSami);

    if (!codigoSaftNormalizado) {
      setError("Escriba el código SAFT.");
      return;
    }

    if (!descripcionSaft.trim()) {
      setError("Escriba la descripción del código SAFT.");
      return;
    }

    if (!codigoSamiNormalizado) {
      setError("Seleccione la cuenta SAMI que recibirá este código SAFT.");
      return;
    }

    try {
      setGuardando(true);
      setError("");
      setMensaje("");
      await guardarEquivalenciaRubroIngreso({
        codigoSaft: codigoSaftNormalizado,
        descripcionSaft: descripcionSaft.trim(),
        codigoSami: codigoSamiNormalizado,
      });
      const catalogosActualizados =
        await obtenerCatalogosConversorSamiSaft();
      onCatalogosActualizados(catalogosActualizados);
      setMensaje(
        `El código SAFT ${codigoSaftNormalizado} quedó vinculado con SAMI ${codigoSamiNormalizado}.`
      );
      setCodigoSaft("");
      setDescripcionSaft("");
      setCodigoSami("");
      setBusquedaSami("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo guardar la equivalencia."
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section
      id="equivalencias-saft-sami"
      className="border border-slate-200 bg-white shadow-sm"
    >
      <header className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
            <Link2 className="h-4 w-4" />
            Catálogo de conversión
          </div>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">
            Códigos SAFT y cuentas SAMI
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
            Cree un código SAFT nuevo o cambie su equivalencia. Cada código
            SAFT se vincula con una cuenta existente del catálogo SAMI.
          </p>
        </div>
        <button
          type="button"
          onClick={nuevaEquivalencia}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
        >
          <Plus className="h-4 w-4" />
          Nuevo código SAFT
        </button>
      </header>

      {pendientes.length > 0 && (
        <div className="border-b border-amber-200 bg-amber-50 px-5 py-4">
          <div className="text-sm font-semibold text-amber-950">
            Códigos pendientes encontrados en el archivo
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {pendientes.map((rubro) => (
              <button
                key={rubro.codigo}
                type="button"
                onClick={() => seleccionarCodigo(rubro.codigo, rubro.descripcion)}
                className="border border-amber-300 bg-white px-3 py-2 text-left text-xs font-semibold text-amber-950 transition hover:bg-amber-100"
              >
                {rubro.codigo} · {rubro.descripcion}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-5 p-5">
        {error && (
          <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {error}
          </div>
        )}
        {mensaje && (
          <div className="flex items-center gap-2 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {mensaje}
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-[minmax(190px,0.7fr)_minmax(260px,1.2fr)_minmax(360px,1.7fr)]">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Código SAFT
            </label>
            <input
              value={codigoSaft}
              onChange={(event) => setCodigoSaft(event.target.value)}
              placeholder="Ejemplo: 11111001"
              className="h-11 w-full border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Descripción SAFT
            </label>
            <input
              value={descripcionSaft}
              onChange={(event) => setDescripcionSaft(event.target.value)}
              placeholder="Nombre del rubro en SAFT"
              className="h-11 w-full border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Cuenta SAMI
            </label>
            <div className="grid gap-2 sm:grid-cols-[minmax(160px,0.8fr)_minmax(220px,1.2fr)]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={busquedaSami}
                  onChange={(event) => setBusquedaSami(event.target.value)}
                  placeholder="Filtrar cuentas"
                  className="h-11 w-full border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-emerald-500"
                />
              </div>
              <select
                value={codigoSami}
                onChange={(event) => setCodigoSami(event.target.value)}
                className="h-11 w-full border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-500"
              >
                <option value="">Seleccione una cuenta SAMI</option>
                {codigoSami &&
                  !cuentasSamiFiltradas.some(
                    (rubro) =>
                      normalizarCodigoRubro(rubro.codigo) === codigoSami
                  ) && (
                    <option value={codigoSami}>{codigoSami}</option>
                  )}
                {cuentasSamiFiltradas.map((rubro) => (
                  <option key={rubro.codigo} value={normalizarCodigoRubro(rubro.codigo)}>
                    {rubro.codigo} · {rubro.descripcion}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void guardar()}
            disabled={guardando}
            className="inline-flex h-11 items-center justify-center gap-2 border border-emerald-700 bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {guardando ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            {guardando ? "Guardando..." : "Guardar equivalencia"}
          </button>
        </div>

        <div className="border border-slate-200">
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">
                Equivalencias actuales
              </div>
              <div className="text-xs text-slate-500">
                {catalogos.equivalencias.length} código(s) vinculados
              </div>
            </div>
            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={busquedaEquivalencia}
                onChange={(event) => setBusquedaEquivalencia(event.target.value)}
                placeholder="Buscar SAFT o SAMI"
                className="h-9 w-full border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-emerald-500"
              />
            </div>
          </div>
          <div className="max-h-[360px] overflow-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Código SAFT</th>
                  <th className="px-3 py-2">Descripción SAFT</th>
                  <th className="px-3 py-2">Cuenta SAMI</th>
                  <th className="px-3 py-2 text-center">Acción</th>
                </tr>
              </thead>
              <tbody>
                {equivalenciasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">
                      No se encontraron equivalencias.
                    </td>
                  </tr>
                ) : (
                  equivalenciasFiltradas.map((equivalencia) => (
                    <tr key={equivalencia.codigoSaft} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-semibold text-slate-950">
                        {equivalencia.codigoSaft}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {equivalencia.descripcionSaft}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        <span className="font-semibold">{equivalencia.codigoSami}</span>
                        <span className="ml-2">{equivalencia.descripcionSami}</span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            seleccionarCodigo(
                              equivalencia.codigoSaft,
                              equivalencia.descripcionSaft
                            )
                          }
                          className="inline-flex h-8 items-center justify-center gap-1.5 border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-slate-500"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
