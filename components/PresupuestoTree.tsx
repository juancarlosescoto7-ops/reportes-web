"use client";

import { useEffect, useState } from "react";

const LEVEL_BG = [
  "bg-white/85 hover:bg-white",
  "bg-[#f3fbf8] hover:bg-[#edf8f4]",
  "bg-[#edf8f4] hover:bg-[#e6f5ef]",
  "bg-[#e6f5ef] hover:bg-[#def1ea]",
  "bg-[#def1ea] hover:bg-[#d6ece4]",
  "bg-[#d6ece4] hover:bg-[#cee7de]",
];

function formatMoney(value: number) {
  return value.toLocaleString("es-HN", {
    style: "currency",
    currency: "HNL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getDepthBackground(depth: number, expandedBySearch?: boolean) {
  if (expandedBySearch) return "bg-[#e8f8f2] hover:bg-[#dff4ed]";
  return LEVEL_BG[Math.min(depth, LEVEL_BG.length - 1)];
}

function getSaldoClass(value: number) {
  if (value < 0) return "text-rose-700 font-semibold";
  if (value > 0) return "text-slate-900 font-semibold";
  return "text-slate-500";
}

function getNivelLabel(depth: number) {
  return depth === 0 ? "Nivel raíz" : `Nivel ${depth + 1}`;
}

function BudgetNode({
  node,
  depth = 0,
}: {
  node: any;
  depth?: number;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (node.expandedBySearch) {
      setOpen(true);
    }
  }, [node.expandedBySearch]);

  const children = Array.from(node.children?.values?.() ?? []) as any[];
  const hasChildren = children.length > 0;

  const vigente = node.kpis?.vigente ?? 0;
  const ejecutado = node.kpis?.ejecutado ?? 0;
  const comprometido = node.kpis?.comprometido ?? 0;
  const saldo = vigente - ejecutado - comprometido;

  function toggle() {
    if (!hasChildren) return;
    setOpen((prev) => !prev);
  }

  return (
    <div className="relative">
      <div
        onClick={toggle}
        role={hasChildren ? "button" : undefined}
        tabIndex={hasChildren ? 0 : undefined}
        onKeyDown={(e) => {
          if (!hasChildren) return;

          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          }
        }}
        className={[
          "relative border-b border-slate-200 transition-colors",
          getDepthBackground(depth, node.expandedBySearch),
          hasChildren ? "cursor-pointer" : "cursor-default",
          node.expandedBySearch
            ? "border-l-2 border-l-[#00be87]"
            : open
            ? "border-l-2 border-l-[#00be87]/70"
            : "border-l-2 border-l-transparent",
        ].join(" ")}
      >
        <div className="grid min-h-[50px] grid-cols-[1fr_auto]">
          {/* INFORMACIÓN DEL GRUPO */}
          <div className="flex min-w-0 items-center">
            {/* CONTROL */}
            <div className="flex h-full w-[42px] shrink-0 items-center justify-center border-r border-slate-200">
              {hasChildren ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle();
                  }}
                  className="h-6 w-6 border border-slate-300 bg-white/80 text-[14px] leading-none text-slate-700 transition hover:border-[#00be87] hover:bg-white"
                  title={open ? "Contraer grupo" : "Expandir grupo"}
                >
                  {open ? "−" : "+"}
                </button>
              ) : (
                <span className="h-1.5 w-1.5 bg-slate-400" />
              )}
            </div>

            {/* CONTENIDO JERÁRQUICO */}
            <div
              className="relative flex min-w-0 flex-1 items-center px-3 py-2"
              style={{ paddingLeft: `${14 + depth * 30}px` }}
            >
              {/* CONECTOR HORIZONTAL DEL HIJO */}
              {depth > 0 && (
                <span
                  className="absolute top-1/2 h-px bg-[#00be87]/30"
                  style={{
                    left: `${depth * 30 - 12}px`,
                    width: "22px",
                  }}
                />
              )}

              {/* MARCA VERTICAL DEL NIVEL */}
              {depth > 0 && (
                <span
                  className="absolute bottom-0 top-0 w-px bg-[#00be87]/20"
                  style={{
                    left: `${depth * 30 - 12}px`,
                  }}
                />
              )}

              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="truncate text-[13px] font-semibold text-slate-950">
                    {node.name}
                  </div>

                  {hasChildren && (
                    <span className="shrink-0 text-[10px] text-slate-500">
                      {children.length} subniveles
                    </span>
                  )}
                </div>

                <div className="mt-0.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-slate-500">
                  <span>{node.level}</span>
                  <span className="text-slate-400">/</span>
                  <span>{getNivelLabel(depth)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* RESUMEN FINANCIERO */}
          <div className="flex min-w-[460px] items-center justify-end gap-5 border-l border-slate-200 px-3 py-2 text-[11px]">
            <InlineMetric label="Vigente" value={formatMoney(vigente)} />

            <InlineMetric
              label="Ejecutado"
              value={formatMoney(ejecutado)}
            />

            <InlineMetric
              label="Comprometido"
              value={formatMoney(comprometido)}
            />

            <InlineMetric
              label="Saldo"
              value={formatMoney(saldo)}
              valueClass={getSaldoClass(saldo)}
            />
          </div>
        </div>
      </div>

      {/* HIJOS */}
      {open && hasChildren && (
        <div className="relative">
          {children.map((child: any) => (
            <BudgetNode
              key={child.id}
              node={child}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PresupuestoTree({
  tree,
}: {
  tree: Map<string, any>;
}) {
  const nodes = Array.from(tree.values());

  return (
    <div className="h-full overflow-hidden border border-slate-300 bg-white/65 text-slate-800 backdrop-blur-xl">
      {/* HEADER */}
      <div className="border-b border-slate-300 bg-white/70 px-3 py-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Explorador presupuestario
        </div>

        <div className="mt-0.5 flex items-center justify-between">
          <div className="text-[13px] font-semibold text-slate-950">
            Estructura programática
          </div>

          <div className="text-[11px] text-slate-500">
            {nodes.length} registros raíz
          </div>
        </div>
      </div>

      {/* ÁRBOL */}
      <div className="h-[calc(100%-49px)] overflow-auto">
        <div className="min-w-[980px]">
          {nodes.length > 0 ? (
            nodes.map((node: any) => (
              <BudgetNode key={node.id} node={node} />
            ))
          ) : (
            <div className="px-3 py-10 text-center text-[12px] text-slate-400">
              No hay estructura presupuestaria disponible.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type InlineMetricProps = {
  label: string;
  value: string;
  valueClass?: string;
};

function InlineMetric({
  label,
  value,
  valueClass = "text-slate-800",
}: InlineMetricProps) {
  return (
    <div className="whitespace-nowrap text-right">
      <span className="mr-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
        {label}
      </span>

      <span className={`tabular-nums text-[12px] ${valueClass}`}>
        {value}
      </span>
    </div>
  );
}