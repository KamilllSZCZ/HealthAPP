import { storage } from "@/src/utils/storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
const TOKEN_KEY = "lifesync_token";

export async function getToken(): Promise<string | null> {
  return (await storage.secureGet<string>(TOKEN_KEY, "")) || null;
}

export async function setToken(token: string) {
  await storage.secureSet(TOKEN_KEY, token);
}

export async function clearToken() {
  await storage.secureRemove(TOKEN_KEY);
}

type Options = {
  method?: string;
  body?: any;
  auth?: boolean;
};

export async function api<T = any>(path: string, opts: Options = {}): Promise<T> {
  const { method = "GET", body, auth = true } = opts;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = await getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = "Request failed";
    try {
      const j = await res.json();
      detail = j.detail || detail;
    } catch {}
    const err = new Error(detail) as any;
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return {} as T;
  return (await res.json()) as T;
}
