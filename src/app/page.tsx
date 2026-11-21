import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";

export default async function Home({ searchParams }: {
  searchParams: Promise<{ track?: string }>;
}) {
  await requireUser();
  const { track } = await searchParams;
  const scope = track === "upstream" || track === "downstream" ? track : "all";
  redirect(`/tenders?track=${scope}`);
}
