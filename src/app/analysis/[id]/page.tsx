import { redirect } from "next/navigation";

export default async function SummaryRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/resources/analysis/${id}`);
}
