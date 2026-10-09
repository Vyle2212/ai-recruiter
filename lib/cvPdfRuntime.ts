import path from "node:path";
import nodeModule from "node:module";

export function pdfStandardFontDataUrl(): string {
  // Resolve against the deployed application's node_modules at runtime.
  // A module-relative createRequire(import.meta.url).resolve(...) is folded
  // into a numeric module ID by Webpack, which is not a filesystem path.
  const runtimeRequire = nodeModule.createRequire(
    path.join(process.cwd(), "package.json"),
  );
  return (
    path.join(
      path.dirname(runtimeRequire.resolve("pdfjs-dist/package.json")),
      "standard_fonts",
    ) + path.sep
  );
}
