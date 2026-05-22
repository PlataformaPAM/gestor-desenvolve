import { redirect } from "next/navigation";
import { getServerFinanceiroRedirect } from "@/lib/server/financeiro-route-guard";
import FinanceiroFluxoPage from "./fluxo-page";

export default async function FinanceiroPage() {
  const target = await getServerFinanceiroRedirect("/financeiro");
  if (target) redirect(target);
  return <FinanceiroFluxoPage />;
}
