import React, { useState, useEffect, useRef, useCallback } from "react";
import { useGetChatMessages, useSendChatMessage, getGetChatMessagesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { useSSE } from "../contexts/SSEContext";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Send, X, Smile } from "lucide-react";
import { Link } from "wouter";
import { UserAvatar } from "./UserAvatar";
import { UserProfileModal } from "./UserProfileModal";
import { useToast } from "../hooks/use-toast";

import { getTierColor } from "../lib/tierColor";

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const CHAT_EMOJIS: { code: string; src: string; label: string }[] = [
  { code: ":laugh:", src: "/emojis/laugh.png", label: "Laugh" },
  { code: ":mlg:", src: "/emojis/mlg.png", label: "MLG" },
  { code: ":blush:", src: "/emojis/ujo.png", label: "Blush" },
  { code: ":mad:", src: "/emojis/mad.png", label: "Mad" },
  { code: ":kiss:", src: "/emojis/kiss.webp", label: "Kiss" },
];

function renderMessageWithMentions(
  text: string,
  onMentionClick: (username: string) => void
): React.ReactNode[] {
  const emojiCodes = CHAT_EMOJIS.map((e) => e.code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const splitPattern = new RegExp(`(@[a-zA-Z0-9_]+|${emojiCodes.join("|")})`, "g");
  const parts = text.split(splitPattern);
  return parts.map((part, i) => {
    if (/^@[a-zA-Z0-9_]+$/.test(part)) {
      const username = part.slice(1);
      return (
        <button
          key={i}
          onClick={() => onMentionClick(username)}
          className="font-bold transition-all duration-150 hover:opacity-80"
          style={{
            color: "#ffffff",
            textShadow: "0 0 5px rgba(255,255,255,0.35), 0 0 10px rgba(255,255,255,0.15)",
          }}
        >
          {part}
        </button>
      );
    }
    const emoji = CHAT_EMOJIS.find((e) => e.code === part);
    if (emoji) {
      return (
        <img
          key={i}
          src={emoji.src}
          alt={emoji.label}
          title={emoji.code}
          className="inline-block w-5 h-5 align-middle mx-0.5"
          style={{ imageRendering: "pixelated" }}
        />
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

// Generate a stable session ID for this browser session
function getSessionId(): string {
  const key = "__ct_sid";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(key, id);
  }
  return id;
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const [onlineCount, setOnlineCount] = useState(1);

  const { on } = useSSE();

  const { data: messages = [] } = useGetChatMessages({
    query: {
      refetchInterval: 30_000,
      refetchIntervalInBackground: false,
    }
  });

  // Receive new chat messages instantly via SSE
  useEffect(() => {
    const queryKey = getGetChatMessagesQueryKey();
    const unsub = on("chat_message", (msg: any) => {
      queryClient.setQueryData(queryKey, (old: any[] = []) => {
        // Avoid duplicates by real ID
        if (old.some((m) => m.id === msg.id)) return old;
        // Replace any optimistic placeholder for the same user+content
        const filtered = old.filter(
          (m) => !(String(m.id).startsWith("optimistic-") && m.userId === msg.userId && m.message === msg.message)
        );
        return [...filtered, msg];
      });
    });
    return unsub;
  }, [on, queryClient]);

  // Heartbeat: ping the server every 30 s to register this session as online
  useEffect(() => {
    const sessionId = getSessionId();
    const beat = async () => {
      try {
        const res = await fetch("/api/presence/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        if (res.ok) {
          const data = await res.json();
          setOnlineCount(Math.max(1, data.count));
        }
      } catch {}
    };
    beat(); // fire immediately
    const id = setInterval(beat, 30_000);
    return () => clearInterval(id);
  }, []);

  const sendMessage = useSendChatMessage();
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !user) return;
    if (cooldown > 0) {
      toast({
        title: `Cooldown for ${cooldown} second${cooldown !== 1 ? "s" : ""}`,
        variant: "destructive",
        duration: 2000,
      });
      return;
    }
    const trimmed = message.trim();

    const isCommand = trimmed.startsWith("/");
    if (!isCommand) {
      const optimisticMsg = {
        id: `optimistic-${Date.now()}`,
        userId: user.id,
        username: user.username,
        avatar: (user as any).avatar ?? undefined,
        level: (user as any).level ?? 1,
        message: trimmed,
        createdAt: new Date().toISOString(),
      };
      const queryKey = getGetChatMessagesQueryKey();
      queryClient.setQueryData(queryKey, (old: any[] = []) => [...old, optimisticMsg]);
      setMessage("");
    }

    sendMessage.mutate({ data: { message: trimmed } }, {
      onSuccess: (data: any) => {
        if (isCommand) setMessage("");
        if (data?.system) {
          toast({ title: data.message, duration: 4000 });
        } else {
          setCooldown(3);
          queryClient.invalidateQueries({ queryKey: getGetChatMessagesQueryKey() });
        }
      },
      onError: (err: any) => {
        if (!isCommand) {
          queryClient.invalidateQueries({ queryKey: getGetChatMessagesQueryKey() });
          setMessage(trimmed);
        }
        const msg = err?.response?.data?.error ?? err?.message ?? "Failed to send.";
        toast({ title: msg, variant: "destructive", duration: 3000 });
      },
    });
  };

  const handleMentionClick = useCallback(async (username: string) => {
    try {
      const res = await fetch(`/api/users/by-username/${encodeURIComponent(username)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.id) setProfileUserId(data.id);
    } catch {
      // ignore
    }
  }, []);

  const insertEmoji = useCallback((code: string) => {
    setMessage((prev) => prev + code);
    setEmojiPickerOpen(false);
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!emojiPickerOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const insidePicker = emojiPickerRef.current?.contains(target);
      const insideButton = emojiButtonRef.current?.contains(target);
      if (!insidePicker && !insideButton) {
        setEmojiPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [emojiPickerOpen]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!isOpen) return null;

  return (
    <>
      <aside className="w-full sm:w-72 border-r border-sidebar-border bg-sidebar flex flex-col h-[100dvh] fixed left-0 top-0 bottom-0 z-[60]">
        <div className="p-4 border-b border-sidebar-border flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-bold text-lg text-primary">Live Chat</h2>
            <div className="flex items-center gap-1 bg-green-500/10 border border-green-500/30 px-1.5 py-0.5 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-green-400 text-xs font-semibold">LIVE</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-green-400 text-xs font-semibold">{onlineCount} Online</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={onToggle}
            title="Close chat"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.length === 0 && (
              <p className="text-xs text-muted-foreground/50 text-center py-4">No messages yet. Say hi!</p>
            )}

            {messages.map((msg) => {
              const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
              const uid = msg.userId;
              return (
                <div key={msg.id} className="text-lg">
                  <div className="flex items-start gap-2">
                    <button
                      className={`relative w-7 h-7 rounded-full overflow-visible flex-shrink-0 mt-0.5 cursor-pointer transition-all${(msg as any).level >= 150 ? " rainbow-avatar-glow" : (msg as any).level >= 100 ? " avatar-tier-glow" : ""}`}
                      style={{ "--glow-color": `${getTierColor((msg as any).level ?? 1)}` } as React.CSSProperties}
                      onClick={() => setProfileUserId(uid)}
                      title={`View ${msg.username}'s profile`}
                    >
                      <div
                        className={`w-7 h-7 rounded-full overflow-hidden border-2${(msg as any).level >= 150 ? " rainbow-avatar-border" : ""}`}
                        style={(msg as any).level >= 150 ? { borderWidth: "2px" } : { borderColor: getTierColor((msg as any).level ?? 1) }}
                      >
                        <UserAvatar avatar={(msg as any).avatar} size={28} />
                      </div>
                      <span
                        className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full text-[7px] font-black flex items-center justify-center border border-background${(msg as any).level >= 150 ? " rainbow-level-badge" : ""}`}
                        style={(msg as any).level >= 150 ? {} : { background: getTierColor((msg as any).level ?? 1), color: "#fff" }}
                      >
                        {(msg as any).level ?? 1}
                      </span>
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="font-bold flex items-center gap-1.5 min-w-0">
                          <button
                            className="truncate text-foreground/90 hover:text-primary transition-colors cursor-pointer"
                            onClick={() => setProfileUserId(uid)}
                          >
                            {msg.username}
                          </button>
                          {msg.username === "Cylax" && (
                            <span className="text-xs font-black flex-shrink-0" style={{ color: "#f472b6", textShadow: "0 0 8px #f472b6, 0 0 16px #f472b6aa" }}>OWNER</span>
                          )}
                        </span>
                        <span className="text-base text-muted-foreground/50 flex-shrink-0">{time}</span>
                      </div>
                      <p className="text-muted-foreground break-words">
                        {renderMessageWithMentions(msg.message, handleMentionClick)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-sidebar-border pb-20 lg:pb-4">
          {user ? (
            <div className="relative">
              {emojiPickerOpen && (
                <div
                  ref={emojiPickerRef}
                  className="absolute bottom-full mb-2 left-0 bg-card border border-border rounded-xl p-2 shadow-xl z-10 flex flex-wrap gap-1.5"
                  style={{ minWidth: "120px" }}
                >
                  {CHAT_EMOJIS.map((emoji) => (
                    <button
                      key={emoji.code}
                      type="button"
                      onClick={() => insertEmoji(emoji.code)}
                      title={emoji.label}
                      className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-primary/20 transition-colors"
                    >
                      <img
                        src={emoji.src}
                        alt={emoji.label}
                        className="w-7 h-7"
                        style={{ imageRendering: "pixelated" }}
                      />
                    </button>
                  ))}
                </div>
              )}
              <form onSubmit={handleSend} className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Say something..."
                  className="flex-1 bg-input/50 text-base"
                  maxLength={200}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                />
                <Button
                  ref={emojiButtonRef}
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => setEmojiPickerOpen((v) => !v)}
                  className="shrink-0 h-10 w-10 text-muted-foreground hover:text-primary"
                  title="Emojis"
                >
                  <Smile className="h-4 w-4" />
                </Button>
                <Button type="submit" size="icon" disabled={!message.trim() || sendMessage.isPending || cooldown > 0} className="relative shrink-0 h-10 w-10">
                  {cooldown > 0 ? (
                    <span className="text-xs font-bold">{cooldown}</span>
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </div>
          ) : (
            <Link href="/login" className="flex items-center justify-center w-full bg-input/50 text-muted-foreground text-sm p-2 rounded-md hover:bg-input hover:text-foreground transition-colors">
              Login to chat
            </Link>
          )}
        </div>
      </aside>

      <UserProfileModal
        userId={profileUserId}
        onClose={() => setProfileUserId(null)}
      />
    </>
  );
}
