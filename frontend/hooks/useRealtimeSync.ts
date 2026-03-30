"use client";

import { useEffect, useRef, useState } from "react";

import { getSocket } from "@/lib/socket";

type RealtimeState = "live" | "fallback";

type UseRealtimeSyncOptions = {
  load: () => Promise<void>;
  pollIntervalMs?: number;
  staleAfterMs?: number;
};

export function useRealtimeSync({
  load,
  pollIntervalMs = 30000,
  staleAfterMs = 60000,
}: UseRealtimeSyncOptions) {
  const loadRef = useRef(load);
  const lastSyncRef = useRef<number>(0);
  const [state, setState] = useState<RealtimeState>("live");
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    const socket = getSocket();
    let disposed = false;

    const sync = async () => {
      try {
        await loadRef.current();
        if (!disposed) {
          const now = Date.now();
          lastSyncRef.current = now;
          setLastSyncAt(new Date(now));
          setState(socket.connected ? "live" : "fallback");
        }
      } catch (error) {
        console.error("Realtime sync failed", error);
      }
    };

    const onConnect = () => {
      setState("live");
      void sync();
    };

    const onDisconnect = () => {
      setState("fallback");
    };

    const onConnectError = () => {
      setState("fallback");
    };

    void sync();

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);

    const interval = window.setInterval(() => {
      const isStale = Date.now() - lastSyncRef.current > staleAfterMs;
      if (!socket.connected || isStale) {
        setState(socket.connected ? "live" : "fallback");
        void sync();
      }
    }, pollIntervalMs);

    return () => {
      disposed = true;
      window.clearInterval(interval);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
    };
  }, [pollIntervalMs, staleAfterMs]);

  return {
    connectionState: state,
    isFallbackPolling: state === "fallback",
    lastSyncAt,
    refreshNow: async () => {
      await loadRef.current();
      const now = Date.now();
      lastSyncRef.current = now;
      setLastSyncAt(new Date(now));
      setState(getSocket().connected ? "live" : "fallback");
    },
  };
}
