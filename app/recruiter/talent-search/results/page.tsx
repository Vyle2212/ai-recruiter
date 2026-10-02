import { redirect } from "next/navigation";
import { searchV2LegacyResultsUrl } from "@/lib/searchV2LegacyRedirect";

export default async function LegacyResultsRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  redirect(searchV2LegacyResultsUrl(await searchParams));
}
