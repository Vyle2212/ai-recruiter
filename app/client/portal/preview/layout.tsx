import { Suspense } from "react";
import MvpPortalLink from "./MvpPortalLink";

export default function ClientPortalPreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Suspense fallback={null}>
        <MvpPortalLink />
      </Suspense>

      {children}
    </>
  );
}