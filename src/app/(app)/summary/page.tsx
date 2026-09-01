import { SummaryView } from "@/components/summary/summary-view";
import { getMonthlySummary } from "@/lib/summary";

export default async function SummaryPage() {
  const summary = await getMonthlySummary();
  return <SummaryView summary={summary} />;
}
