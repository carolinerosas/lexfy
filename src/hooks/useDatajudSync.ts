"use client";

import { useEffect, useRef, useCallback } from "react";
import { sincronizarTodos } from "@/lib/store";

const POLL_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const AUTO_SYNC_ENABLED = process.env.NEXT_PUBLIC_ENABLE_AUTO_SYNC === "true";

function notifyBrowser(novas: number) {
  if (typeof window === "undefined") return;
  if (Notification.permission !== "granted") return;
  new Notification("Justio — Novas movimentações", {
    body: `${novas} nova${novas > 1 ? "s" : ""} movimentaç${novas > 1 ? "ões" : "ão"} detectada${novas > 1 ? "s" : ""} nos seus processos.`,
    icon: "/favicon.ico",
  });
}

async function requestNotificationPermission() {
  if (typeof window === "undefined") return;
  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }
}

export function useDatajudSync(onSync?: (novas: number) => void) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runningRef = useRef(false);

  const sync = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      const { novas } = await sincronizarTodos();
      if (novas > 0) {
        notifyBrowser(novas);
        onSync?.(novas);
      }
    } finally {
      runningRef.current = false;
    }
  }, [onSync]);

  useEffect(() => {
    if (!AUTO_SYNC_ENABLED) return;

    requestNotificationPermission();
    // First sync after 30s (let page settle), then every 10 min
    const initial = setTimeout(sync, 30_000);
    timerRef.current = setInterval(sync, POLL_INTERVAL_MS);
    return () => {
      clearTimeout(initial);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sync]);

  return { syncAgora: sync };
}
