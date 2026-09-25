import { redirect } from "next/navigation";

// Keep old bookmarks on the private, original-preserving upload flow.
export default function LegacyUploadCvPage() {
  redirect("/upload");
}
