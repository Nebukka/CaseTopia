import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { useGetMe } from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react";

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (user: User, token: string) => void;
  logout: () => void;
  refreshUser: () => void;
  updateUser: (patch: Partial<User>) => void;
  deltaBalance: (delta: number) => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  levelUpEvent: number | null;
  clearLevelUp: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

let _currentToken: string | null = localStorage.getItem("bettopia_token");

setAuthTokenGetter(() => _currentToken);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem("bettopia_token"));
  const [user, setUser] = useState<User | null>(null);
  const [levelUpEvent, setLevelUpEvent] = useState<number | null>(null);

  // Tracks the last known level — used to detect level-ups
  const prevLevelRef = useRef<number | null>(null);

  const { data: meData, isLoading, refetch } = useGetMe({
    query: {
      enabled: !!token,
      retry: false,
    }
  });

  useEffect(() => {
    if (meData) {
      setUser(meData as User);
    }
  }, [meData]);

  // ── Level-up detection ───────────────────────────────────────────────────
  // Runs whenever the user object changes. Compares current level to the
  // previously known level and fires the celebration if it went up.
  useEffect(() => {
    if (!user) return;
    const currentLevel = (user as any).level ?? 1;

    if (prevLevelRef.current !== null && currentLevel > prevLevelRef.current) {
      setLevelUpEvent(currentLevel);
    }

    prevLevelRef.current = currentLevel;
  }, [user]);

  const login = (newUser: User, newToken: string) => {
    localStorage.setItem("bettopia_token", newToken);
    _currentToken = newToken;
    setToken(newToken);
    // Set prevLevel before calling setUser so the effect above doesn't
    // misinterpret the initial login as a level-up.
    prevLevelRef.current = (newUser as any).level ?? 1;
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem("bettopia_token");
    _currentToken = null;
    setToken(null);
    setUser(null);
    prevLevelRef.current = null;
  };

  const refreshUser = () => {
    refetch().then((res) => {
      if (res.data) setUser(res.data as User);
    });
  };

  // Simple patch — level-up detection is handled by the useEffect above.
  const updateUser = (patch: Partial<User>) => {
    setUser((prev) => prev ? { ...prev, ...patch } : prev);
  };

  const deltaBalance = (delta: number) => {
    setUser((prev) => prev ? { ...prev, balance: (prev.balance ?? 0) + delta } : prev);
  };

  const clearLevelUp = () => setLevelUpEvent(null);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, refreshUser, updateUser, deltaBalance, isAuthenticated: !!user, isLoading, levelUpEvent, clearLevelUp }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
