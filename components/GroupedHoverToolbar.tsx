"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

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
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeGroup = groups.find((group) => group.id === activeId) ?? null;

  function cancelClose() {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function scheduleClose() {
    cancelClose();
    closeTimerRef.current = setTimeout(() => setActiveId(null), 260);
  }

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  return (
    <div className="col-span-full w-full min-w-0 basis-full" onMouseEnter={cancelClose} onMouseLeave={scheduleClose} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setActiveId(null); }}>
      <div className={`flex w-full flex-wrap items-center gap-2 ${align === "right" ? "sm:justify-end" : "justify-start"}`}>
        {groups.map((group) => (
          <button
            key={group.id}
            type="button"
            onMouseEnter={() => { cancelClose(); setActiveId(group.id); }}
            onFocus={() => setActiveId(group.id)}
            onClick={() =>
              setActiveId((current) => (current === group.id ? null : group.id))
            }
            aria-expanded={activeId === group.id}
            className={[
              "h-10 rounded-xl border px-4 text-[11px] font-semibold transition",
              activeId === group.id || group.active
                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:shadow-sm",
            ].join(" ")}
          >
            {group.label}
          </button>
        ))}
      </div>

      {activeGroup ? (
        <div
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50/70 p-3 shadow-sm"
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
