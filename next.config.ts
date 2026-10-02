import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["rtf-parser-wasm", "pdfjs-dist"],
  outputFileTracingIncludes: {
    "/api/**": [
      "./node_modules/rtf-parser-wasm/rtf_parser_bg.wasm",
      "./node_modules/pdfjs-dist/package.json",
      "./node_modules/pdfjs-dist/legacy/build/*",
      "./node_modules/pdfjs-dist/standard_fonts/*",
    ],
  },
};

export default nextConfig;
