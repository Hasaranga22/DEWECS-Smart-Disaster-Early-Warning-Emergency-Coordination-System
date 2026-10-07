import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  reloadOnOnline: true,
  // Disable the service worker entirely in development.
  // Serwist uses webpack internally; Turbopack handles dev mode.
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  // Declare an empty turbopack config so Next.js 16 does not emit
  // the "webpack config present but no turbopack config" error.
  // The service worker is built during `next build` (webpack path),
  // not during `next dev` (Turbopack path).
  turbopack: {},
};

export default withSerwist(nextConfig);
