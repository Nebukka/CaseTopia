import { useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useSSE } from "../contexts/SSEContext";

interface UseNotificationsOptions {
  onTip?: (message: string) => void;
  onMention?: (message: string) => void;
}

export function useNotifications({ onTip, onMention }: UseNotificationsOptions = {}) {
  const { token, isAuthenticated } = useAuth();
  const { on } = useSSE();
  const seenIds = useRef<Set<number>>(new Set());
  const onTipRef = useRef(onTip);
  const onMentionRef = useRef(onMention);
  onTipRef.current = onTip;
  onMentionRef.current = onMention;

  // Real-time: receive notifications instantly via SSE
  useEffect(() => {
    const unsub = on("notification", (data: { type: string; message: string }) => {
      if (data.type === "tip" && onTipRef.current) onTipRef.current(data.message);
      if (data.type === "mention" && onMentionRef.current) onMentionRef.current(data.message);
    });
    return unsub;
  }, [on]);

  // Fallback polling every 30 s (catches any missed events on reconnect)
  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const poll = async () => {
      try {
        const res = await fetch("/api/notifications", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const notifications: { id: number; type: string; message: string }[] = await res.json();

        const fresh = notifications.filter((n) => !seenIds.current.has(n.id));
        if (!fresh.length) return;

        for (const n of fresh) {
          seenIds.current.add(n.id);
          if (n.type === "tip" && onTipRef.current) onTipRef.current(n.message);
          else if (n.type === "mention" && onMentionRef.current) onMentionRef.current(n.message);
        }

        await fetch("/api/notifications/mark-read", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {}
    };

    poll();
    const interval = setInterval(poll, 30_000);
    return () => clearInterval(interval);
  }, [isAuthenticated, token]);
}
