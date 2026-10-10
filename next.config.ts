import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Declare an empty turbopack config so Next.js 16 does not emit
  // the "webpack config present but no turbopack config" error.
  turbopack: {},
};

let withSerwist: (cfg: NextConfig) => NextConfig = (cfg) => cfg;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const serwistModule = require("@serwist/next");
  const withSerwistInit = typeof serwistModule === "function" ? serwistModule : serwistModule?.default;
  if (withSerwistInit) {
    withSerwist = withSerwistInit({
      swSrc: "src/app/sw.ts",
      swDest: "public/sw.js",
      reloadOnOnline: true,
      // Disable the service worker entirely in development.
      // Serwist uses webpack internally; Turbopack handles dev mode.
      disable: process.env.NODE_ENV === "development",
    });
  }
} catch {
  // @serwist/next not installed in current environment; proceed with base NextConfig
}

export default withSerwist(nextConfig);
