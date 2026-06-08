import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { api, setToken, clearToken, getToken } from "./api";

type User = {
  user_id: string;
  email: string;
  name: string;
  picture?: string | null;
  auth_provider: string;
  profile: Record<string, any>;
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (u: User) => void;
};

const Ctx = createContext<AuthCtx>({} as AuthCtx);
export const useAuth = () => useContext(Ctx);

const EMERGENT_AUTH = "https://auth.emergentagent.com";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        setUser(null);
        return;
      }
      const me = await api<User>("/auth/me");
      setUser(me);
    } catch {
      await clearToken();
      setUser(null);
    }
  }, []);

  const processSessionId = useCallback(async (sessionId: string) => {
    try {
      const res = await api<{ token: string; user: User }>("/auth/google/session", {
        method: "POST",
        auth: false,
        body: { session_token: sessionId },
      });
      await setToken(res.token);
      setUser(res.user);
    } catch (e) {
      console.warn("google session failed", e);
    }
  }, []);

  useEffect(() => {
    (async () => {
      // Web: handle session_id returned in URL hash/query first
      if (Platform.OS === "web" && typeof window !== "undefined") {
        const hash = window.location.hash || "";
        const search = window.location.search || "";
        const m = hash.match(/session_id=([^&]+)/) || search.match(/session_id=([^&]+)/);
        if (m) {
          await processSessionId(decodeURIComponent(m[1]));
          window.history.replaceState(null, "", window.location.pathname);
          setLoading(false);
          return;
        }
      } else {
        // Mobile cold-start deep link fallback
        const initial = await Linking.getInitialURL();
        if (initial) {
          const m = initial.match(/session_id=([^&]+)/);
          if (m) {
            await processSessionId(decodeURIComponent(m[1]));
            setLoading(false);
            return;
          }
        }
      }
      await loadMe();
      setLoading(false);
    })();
  }, [loadMe, processSessionId]);

  const login = async (email: string, password: string) => {
    const res = await api<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      auth: false,
      body: { email, password },
    });
    await setToken(res.token);
    setUser(res.user);
  };

  const register = async (email: string, password: string, name: string) => {
    const res = await api<{ token: string; user: User }>("/auth/register", {
      method: "POST",
      auth: false,
      body: { email, password, name },
    });
    await setToken(res.token);
    setUser(res.user);
  };

  const loginWithGoogle = async () => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const redirect = window.location.origin + "/";
      window.location.href = `${EMERGENT_AUTH}/?redirect=${encodeURIComponent(redirect)}`;
      return;
    }
    const redirectUrl = Linking.createURL("auth");
    const authUrl = `${EMERGENT_AUTH}/?redirect=${encodeURIComponent(redirectUrl)}`;
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
    if (result.type === "success" && result.url) {
      const m = result.url.match(/session_id=([^&]+)/);
      if (m) await processSessionId(decodeURIComponent(m[1]));
    }
  };

  const logout = async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {}
    await clearToken();
    setUser(null);
  };

  return (
    <Ctx.Provider
      value={{ user, loading, login, register, loginWithGoogle, logout, refresh: loadMe, setUser }}
    >
      {children}
    </Ctx.Provider>
  );
}
