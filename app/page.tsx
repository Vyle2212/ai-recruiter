import { productionAuthConfigured } from "@/lib/productionAuthConfiguration";
import LegacyHome from "./LegacyHome";
import { ProductionAuthEntry } from "./auth/production/ProductionAuthEntry";

export const dynamic = "force-dynamic";

export default function Home() {
  return productionAuthConfigured() ? <ProductionAuthEntry /> : <LegacyHome />;
}
