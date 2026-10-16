"use client";

import { useEffect, useRef } from "react";
import { useNetworkStatus } from "./network";
import { syncPendingOutbox } from "./syncOutbox";

/** Automatically drains the device outbox on initial online load and reconnect. */
export function OutboxAutoSync() {
  const { isOnline } = useNetworkStatus();
  const previousOnline = useRef(false);

  useEffect(() => {
    const reconnected = isOnline && !previousOnline.current;
    previousOnline.current = isOnline;

    if (reconnected) {
      void syncPendingOutbox().catch(() => {
        // The outbox remains intact and will be retried on the next reconnect.
      });
    }
  }, [isOnline]);

  return null;
}
