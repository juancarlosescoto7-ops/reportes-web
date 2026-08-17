import CXPDashboard from "@/components/CXPDashboard";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ cxp?: string | string[] }>;
}) {
  const params = await searchParams;
  const cxp = Array.isArray(params.cxp) ? params.cxp[0] : params.cxp;

  return <CXPDashboard focusCxp={cxp ?? null} />;
}
