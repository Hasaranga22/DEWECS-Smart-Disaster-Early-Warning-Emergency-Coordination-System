import { redirect } from "next/navigation";
import { buildQueryString } from "../resources/analysis/_prefill";

export default async function AnalysisRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const qs = buildQueryString(await searchParams);
  redirect(qs ? `/resources/analysis?${qs}` : "/resources/analysis");
}
