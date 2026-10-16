import ReporteMensualCxp from "../components/ReporteMensualCxp";
import ConPermiso from "@/modules/autenticacion/components/ConPermiso";

export default function ReporteMensualCxpPage() {
  const fecha = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Tegucigalpa", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [anio, mes] = fecha.split("-").map(Number);
  const mesAnterior = new Date(Date.UTC(anio, mes - 1, 0)).toISOString().slice(0, 7);
  return <ConPermiso permiso="VER_COMPROMISOS" fallback={<p className="p-6">No tiene permiso para consultar cuentas por pagar.</p>}>
    <ReporteMensualCxp periodoInicial={mesAnterior} anioEmisionInicial={String(anio)} />
  </ConPermiso>;
}
