import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["rtf-parser-wasm"],
  outputFileTracingIncludes: {
    "/api/**": ["./node_modules/rtf-parser-wasm/rtf_parser_bg.wasm"],
  },
};

export default nextConfig;
