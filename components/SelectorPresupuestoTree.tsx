"use client";

import { useEffect, useMemo, useState } from "react";

export type CodigoPresupuestarioSeleccionado = {
  codigo_presupuestario: string;
  actividad_id: string | null;
  proyecto_id: string | null;
  ejercicio_fiscal: number | null;
  nombre: string;
  saldo: number;
};

export type PresupuestoNode = {
  id: string;
  name: string;
  level: string;
  meta?: {
    codigo_presupuestario: string | null;
    actividad_id: string | null;
    proyecto_id: string | null;
    ejercicio_fiscal: number | null;
  };
  kpis: {
    vigente: number;
    ejecutado: number;
    comprometido: number;
  };
  children: Map<string, PresupuestoNode>;
};

const LEVEL_BG = [
  "bg-white/85 hover:bg-white",
  "bg-[#f3fbf8] hover:bg-[#edf8f4]",
  "bg-[#edf8f4] hover:bg-[#e6f5ef]",
  "bg-[#e6f5ef] hover:bg-[#def1ea]",
  "bg-[#def1ea] hover:bg-[#d6ece4]",
  "bg-[#d6ece4] hover:bg-[#cee7de]",
];

function formatMoney(value: number) {
  return Number(value ?? 0).toLocaleString("es-HN", {
    style: "currency",
    currency: "HNL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getDepthBackground(depth: number) {
  return LEVEL_BG[Math.min(depth, LEVEL_BG.length - 1)];
}

function getSaldo(node: PresupuestoNode) {
  return (
    Number(node.kpis?.vigente || 0) -
    Number(node.kpis?.ejecutado || 0) -
    Number(node.kpis?.comprometido || 0)
  );
}

function nodeMatchesSearch(node: PresupuestoNode, term: string) {
  const searchable = [
    node.id,
    node.name,
    node.level,
    node.meta?.codigo_presupuestario,
    node.meta?.actividad_id,
    node.meta?.proyecto_id,
    node.meta?.ejercicio_fiscal,
  ]
    .map(normalizeText)
    .join(" ");

  return searchable.includes(term);
}

function filterTreeBySearch(
  tree: Map<string, PresupuestoNode>,
  search: string
) {
  const term = normalizeText(search);

  if (!term) return tree;

  const filtered = new Map<string, PresupuestoNode>();

  for (const [key, node] of tree.entries()) {
    const filteredChildren = filterTreeBySearch(node.children, search);
    const currentNodeMatches = nodeMatchesSearch(node, term);

    if (currentNodeMatches || filteredChildren.size > 0) {
      filtered.set(key, {
        ...node,
        children: currentNodeMatches ? node.children : filteredChildren,
      });
    }
  }

  return filtered;
}

function countNodes(tree: Map<string, PresupuestoNode>) {
  let total = 0;

  for (const node of tree.values()) {
    total += 1;
    total += countNodes(node.children);
  }

  return total;
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="whitespace-nowrap text-right">
      <span className="mr-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
        {label}
      </span>

      <span className="tabular-nums text-[11px] text-slate-800">{value}</span>
    </div>
  );
}

function BudgetSelectorNode({
  node,
  depth,
  seleccionado,
  searchActive,
  onSelect,
}: {
  node: PresupuestoNode;
  depth: number;
  seleccionado: string | null;
  searchActive: boolean;
  onSelect: (codigo: CodigoPresupuestarioSeleccionado) => void;
}) {
  const [open, setOpen] = useState(depth < 1);

  useEffect(() => {
    if (searchActive) {
      setOpen(true);
    }
  }, [searchActive]);

  const children = Array.from(node.children?.values?.() ?? []);
  const hasChildren = children.length > 0;
  const isCodigo = node.level === "codigo";
  const saldo = getSaldo(node);

  const codigoActual = node.meta?.codigo_presupuestario ?? node.id;
  const active = isCodigo && seleccionado === codigoActual;

  function handleClick() {
    if (isCodigo) {
      onSelect({
        codigo_presupuestario: codigoActual,
        actividad_id: node.meta?.actividad_id ?? null,
        proyecto_id: node.meta?.proyecto_id ?? null,
        ejercicio_fiscal: node.meta?.ejercicio_fiscal ?? null,
        nombre: node.name,
        saldo,
      });

      return;
    }

    if (hasChildren) {
      setOpen((prev) => !prev);
    }
  }

  return (
    <div className="relative">
      <div
        onClick={handleClick}
        className={[
          "relative grid min-h-[44px] grid-cols-[1fr_auto] border-b border-slate-200 transition-colors",
          getDepthBackground(depth),
          isCodigo || hasChildren ? "cursor-pointer" : "cursor-default",
          active
            ? "border-l-2 border-l-[#00be87] bg-[#e6f5ef]"
            : "border-l-2 border-l-transparent",
        ].join(" ")}
      >
        <div
          className="relative flex min-w-0 items-center px-3 py-2"
          style={{ paddingLeft: `${14 + depth * 30}px` }}
        >
          {depth > 0 && (
            <>
              <span
                className="absolute top-1/2 h-px bg-[#00be87]/30"
                style={{
                  left: `${depth * 30 - 12}px`,
                  width: "22px",
                }}
              />

              <span
                className="absolute bottom-0 top-0 w-px bg-[#00be87]/20"
                style={{
                  left: `${depth * 30 - 12}px`,
                }}
              />
            </>
          )}

          <div className="mr-3 flex h-6 w-6 shrink-0 items-center justify-center border border-slate-300 bg-white/80 text-[13px] text-slate-700">
            {hasChildren ? (open ? "−" : "+") : isCodigo ? "•" : ""}
          </div>

          <div className="min-w-0">
            <div className="truncate text-[12px] font-semibold text-slate-950">
              {node.name}
            </div>

            <div className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-slate-500">
              {node.level}
              {isCodigo ? " / seleccionable" : ""}
            </div>
          </div>
        </div>

        <div className="flex min-w-[320px] items-center justify-end gap-4 border-l border-slate-200 px-3 py-2 text-[11px]">
          <MiniMetric label="Vigente" value={formatMoney(node.kpis.vigente)} />
          <MiniMetric label="Saldo" value={formatMoney(saldo)} />
        </div>
      </div>

      {open &&
        children.map((child) => (
          <BudgetSelectorNode
            key={child.id}
            node={child}
            depth={depth + 1}
            seleccionado={seleccionado}
            searchActive={searchActive}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
}

export default function SelectorPresupuestoTree({
  tree,
  seleccionado,
  onSelect,
}: {
  tree: Map<string, PresupuestoNode>;
  seleccionado: string | null;
  onSelect: (codigo: CodigoPresupuestarioSeleccionado) => void;
}) {
  const [search, setSearch] = useState("");

  const filteredTree = useMemo(() => {
    return filterTreeBySearch(tree, search);
  }, [tree, search]);

  const nodes = Array.from(filteredTree.values());
  const searchActive = normalizeText(search).length > 0;
  const totalResultados = useMemo(() => countNodes(filteredTree), [filteredTree]);

  return (
    <div className="h-full overflow-hidden border border-slate-300 bg-white/65 backdrop-blur-xl">
      <div className="border-b border-slate-300 bg-white/70 px-3 py-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Presupuesto
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="text-[13px] font-semibold text-slate-950">
            Selección de código presupuestario
          </div>

          <div className="text-[11px] text-slate-500">
            {searchActive ? `${totalResultados} coincidencias` : "Vista general"}
          </div>
        </div>
      </div>

      <div className="border-b border-slate-300 bg-white/60 px-3 py-2">
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400">
            Buscar
          </span>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="programa, proyecto, actividad, obra o código"
            className="h-8 w-full border border-slate-300 bg-white/80 pl-[58px] pr-9 text-[12px] text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#00be87]"
          />

          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 h-5 w-5 -translate-y-1/2 border border-slate-300 bg-white text-[11px] text-slate-500 hover:border-slate-700 hover:text-slate-900"
              title="Limpiar búsqueda"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className="h-[calc(100%-90px)] overflow-auto">
        <div className="min-w-[780px]">
          {nodes.length > 0 ? (
            nodes.map((node) => (
              <BudgetSelectorNode
                key={node.id}
                node={node}
                depth={0}
                seleccionado={seleccionado}
                searchActive={searchActive}
                onSelect={onSelect}
              />
            ))
          ) : (
            <div className="px-3 py-10 text-center text-[12px] text-slate-400">
              No se encontraron coincidencias en el presupuesto.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}