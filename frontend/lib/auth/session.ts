import { AuthUser } from "@/types/auth";

const TOKEN_KEY = "cip_auth_token";
const USER_KEY = "cip_auth_user";

function isJwtValid(token: string): boolean {
  if (!token || typeof token !== "string" || token.trim() === "" || token === "undefined" || token === "null") {
    return false;
  }
  const parts = token.split(".");
  if (parts.length !== 3) {
    return false;
  }
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const payload = JSON.parse(jsonPayload);
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return false; // Token expired
    }
    return true;
  } catch {
    return false;
  }
}

export function saveSession(token: string, user: AuthUser): void {
  if (typeof window === "undefined") return;
  if (!token || typeof token !== "string" || token === "undefined" || token === "null" || token.trim() === "") {
    console.warn("Attempted to save empty or invalid auth token.");
    return;
  }
  try {
    localStorage.setItem(TOKEN_KEY, token.trim());
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (err) {
    console.error("Failed to save auth session to localStorage", err);
  }
}

export function getSessionUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const token = getSessionToken();
  if (!token) {
    return null;
  }
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function getSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token || !isJwtValid(token)) {
    // If token is missing, expired, or corrupted, clean up stale session
    if (token) {
      clearSession();
    }
    return null;
  }
  return token.trim();
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch (err) {
    console.error("Failed to clear auth session from localStorage", err);
  }
}
