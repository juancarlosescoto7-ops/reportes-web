"use client";

import { ChevronDown } from "lucide-react";
import { Children, isValidElement, useId, useState, type ReactNode } from "react";

function codigosContenido(content: ReactNode): string[] {
  return Children.toArray(content).flatMap((child) => {
    if (!isValidElement<{ "data-shortcut"?: string; children?: ReactNode }>(child)) return [];
    return [child.props["data-shortcut"], ...codigosContenido(child.props.children)].filter((code): code is string => Boolean(code));
  });
}

export type HoverToolGroup = {
  id: string;
  label: string;
  content: ReactNode;
  active?: boolean;
};

export default function GroupedHoverToolbar({
  groups,
  align = "right",
}: {
  groups: readonly HoverToolGroup[];
  align?: "left" | "right";
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const toolbarId = useId();
  const activeGroup = groups.find((group) => group.id === activeId) ?? null;

  return (
    <div className="col-span-full w-full min-w-0 basis-full">
      <div className={`flex w-full flex-wrap items-center gap-2 ${align === "right" ? "sm:justify-end" : "justify-start"}`}>
        {groups.map((group) => (
          <button data-shortcut="293"
            key={group.id}
            id={`${toolbarId}-trigger-${group.id}`}
            type="button"
            data-shortcut-reveals={codigosContenido(group.content).join(" ")}
            onClick={() =>
              setActiveId((current) => (current === group.id ? null : group.id))
            }
            aria-expanded={activeId === group.id}
            aria-controls={activeId === group.id ? `${toolbarId}-panel-${group.id}` : undefined}
            className={[
              "inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2",
              activeId === group.id
                ? "border-emerald-300 bg-emerald-50 text-emerald-800 shadow-sm"
                : group.active
                  ? "border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:shadow-sm",
            ].join(" ")}
          >
            {group.label}
            {group.active ? (
              <>
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="sr-only"> (opciones activas)</span>
              </>
            ) : null}
            <ChevronDown
              aria-hidden="true"
              className={`h-3.5 w-3.5 ${activeId === group.id ? "rotate-180" : ""}`}
            />
          </button>
        ))}
      </div>

      {activeGroup ? (
        <div
          key={activeGroup.id}
          id={`${toolbarId}-panel-${activeGroup.id}`}
          role="region"
          aria-labelledby={`${toolbarId}-trigger-${activeGroup.id}`}
          className="mt-2 w-full rounded-2xl border border-emerald-100 bg-slate-50/70 p-3 shadow-sm"
        >
          <div className="mb-3 border-b border-slate-100 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
            {activeGroup.label}
          </div>
          {activeGroup.content}
        </div>
      ) : null}
    </div>
  );
}
