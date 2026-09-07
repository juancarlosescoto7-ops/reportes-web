type Props = {
  label: string;
  value: string;
  tone?: "normal" | "success" | "warning";
};

export default function ResumenMontoArqueo({
  label,
  value,
  tone = "normal",
}: Props) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50"
        : "border-slate-200 bg-white";

  return (
    <div className={`border px-4 py-3 ${toneClass}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-[16px] font-semibold tabular-nums text-slate-950">
        {value}
      </div>
    </div>
  );
}
