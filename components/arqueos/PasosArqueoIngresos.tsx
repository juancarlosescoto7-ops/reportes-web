import {
  CheckCircle2,
  FileSpreadsheet,
  Landmark,
  Printer,
  type LucideIcon,
} from "lucide-react";

export type PasoArqueoIngresos = 1 | 2 | 3;

type Props = {
  pasoActual: PasoArqueoIngresos;
  conversionDisponible: boolean;
  arqueoCuadrado: boolean;
  onCambiarPaso: (paso: PasoArqueoIngresos) => void;
};

const pasos: {
  numero: PasoArqueoIngresos;
  titulo: string;
  ayuda: string;
  icon: LucideIcon;
}[] = [
  {
    numero: 1,
    titulo: "Cargar y convertir",
    ayuda: "Seleccione el Excel de SAFT",
    icon: FileSpreadsheet,
  },
  {
    numero: 2,
    titulo: "Revisar e imprimir",
    ayuda: "Verifique SAMI y registros manuales",
    icon: Printer,
  },
  {
    numero: 3,
    titulo: "Agregar depósitos",
    ayuda: "Cuadre y guarde el arqueo",
    icon: Landmark,
  },
];

export default function PasosArqueoIngresos({
  pasoActual,
  conversionDisponible,
  arqueoCuadrado,
  onCambiarPaso,
}: Props) {
  return (
    <div className="grid gap-2 border-b border-slate-200 bg-slate-50 p-3 md:grid-cols-3">
      {pasos.map((paso) => {
        const Icon = paso.icon;
        const habilitado = paso.numero === 1 || conversionDisponible;
        const completado =
          paso.numero === 1
            ? conversionDisponible
            : paso.numero === 2
              ? pasoActual === 3
              : arqueoCuadrado;
        const activo = pasoActual === paso.numero;

        return (
          <button
            key={paso.numero}
            type="button"
            onClick={() => onCambiarPaso(paso.numero)}
            disabled={!habilitado}
            aria-current={activo ? "step" : undefined}
            className={`flex min-h-[72px] items-center gap-3 border px-4 py-3 text-left transition ${
              activo
                ? "border-emerald-600 bg-white shadow-sm"
                : "border-slate-200 bg-white/70 hover:border-slate-400"
            } disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400`}
          >
            <span
              className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                activo
                  ? "bg-emerald-600 text-white"
                  : completado
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-500"
              }`}
            >
              {completado && !activo ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <Icon className="h-5 w-5" />
              )}
            </span>
            <span>
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Paso {paso.numero} de 3
              </span>
              <span className="mt-0.5 block text-sm font-semibold text-slate-900">
                {paso.titulo}
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                {paso.ayuda}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
