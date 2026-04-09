import React, { createContext, useContext, useEffect, useRef } from "react";
import { useAuth } from "./AuthContext";

type SSEHandler = (data: any) => void;

interface SSEContextValue {
  on: (event: string, handler: SSEHandler) => () => void;
}

const SSEContext = createContext<SSEContextValue>({ on: () => () => {} });

export function SSEProvider({ children }: { children: React.ReactNode }) {
  const { token, isAuthenticated } = useAuth();
  const handlersRef = useRef<Map<string, Set<SSEHandler>>>(new Map());
  const esRef = useRef<EventSource | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      esRef.current?.close();
      esRef.current = null;
      return;
    }

    let es: EventSource;

    const connect = () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      es = new EventSource(`/api/sse?token=${encodeURIComponent(token)}`);
      esRef.current = es;

      es.onmessage = (e) => {
        try {
          const { event, payload } = JSON.parse(e.data);
          const handlers = handlersRef.current.get(event);
          if (handlers) for (const h of handlers) h(payload);
        } catch {}
      };

      es.onerror = () => {
        es.close();
        esRef.current = null;
        // Reconnect after 2 s
        reconnectRef.current = setTimeout(connect, 2000);
      };
    };

    connect();

    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      es?.close();
      esRef.current = null;
    };
  }, [isAuthenticated, token]);

  const on = (event: string, handler: SSEHandler): (() => void) => {
    if (!handlersRef.current.has(event)) {
      handlersRef.current.set(event, new Set());
    }
    handlersRef.current.get(event)!.add(handler);
    return () => {
      handlersRef.current.get(event)?.delete(handler);
    };
  };

  return <SSEContext.Provider value={{ on }}>{children}</SSEContext.Provider>;
}

export function useSSE() {
  return useContext(SSEContext);
}
