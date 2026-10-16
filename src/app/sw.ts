/// <reference lib="webworker" />

// The reference directive above pulls in the webworker type definitions
// (ServiceWorkerGlobalScope, ExtendableEvent, FetchEvent, etc.) without
// adding "webworker" to tsconfig.json, which would conflict with "dom".
// This file is compiled by Next.js/webpack during `next build` only;
// it never runs under Turbopack (serwist is disabled in development).

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
