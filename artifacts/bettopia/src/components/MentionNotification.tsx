import React, { useEffect, useState } from "react";
import { X, MessageSquare } from "lucide-react";

interface MentionNotificationProps {
  message: string;
  onDismiss: () => void;
}

export function MentionNotification({ message, onDismiss }: MentionNotificationProps) {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(100);

  const DURATION = 6000;

  useEffect(() => {
    const showTimer = setTimeout(() => setVisible(true), 20);
    const startAt = Date.now();
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startAt;
      const remaining = Math.max(0, 100 - (elapsed / DURATION) * 100);
      setProgress(remaining);
      if (remaining === 0) clearInterval(progressInterval);
    }, 50);
    const dismissTimer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 400);
    }, DURATION);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(dismissTimer);
      clearInterval(progressInterval);
    };
  }, [onDismiss]);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(onDismiss, 400);
  };

  return (
    <div
      className={`
        w-80
        transition-all duration-400 ease-out
        ${visible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-95"}
      `}
      style={{ pointerEvents: visible ? "auto" : "none" }}
    >
      <div
        className="relative rounded-2xl overflow-hidden border border-purple-400/40 bg-gradient-to-br from-purple-950/95 via-violet-900/90 to-indigo-900/80 backdrop-blur-sm shadow-2xl"
        style={{ boxShadow: "0 0 32px rgba(168,85,247,0.25), 0 8px 32px rgba(0,0,0,0.6)" }}
      >
        <div className="flex items-start gap-4 p-5">
          <div className="relative shrink-0">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center bg-purple-500/20 border-2 border-purple-400/60"
              style={{ boxShadow: "0 0 20px rgba(168,85,247,0.5)" }}
            >
              <MessageSquare className="w-7 h-7 text-purple-300" />
            </div>
            <span className="absolute -top-1 -right-1 text-base">💬</span>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-purple-300 font-black text-base leading-tight tracking-wide uppercase">
              You were mentioned!
            </p>
            <p className="text-white text-sm font-semibold mt-1 leading-snug break-words">
              {message}
            </p>
          </div>

          <button
            onClick={handleDismiss}
            className="shrink-0 text-purple-400/60 hover:text-purple-300 transition-colors mt-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="absolute bottom-0 left-0 h-1 w-full bg-purple-900/40">
          <div
            className="h-full bg-gradient-to-r from-purple-400 to-violet-500 transition-none rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
