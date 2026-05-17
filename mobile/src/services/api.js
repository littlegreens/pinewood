import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const API_BASE = (process.env.EXPO_PUBLIC_API_URL || "https://pinewood.to").replace(/\/$/, "");

export function getApiBase() {
  return API_BASE;
}

const TOKEN_KEY = "pinewood_access_token";
const REFRESH_KEY = "pinewood_refresh_token";
const USER_KEY = "pinewood_user";

let _listeners = new Set();

function notifyListeners(event) {
  _listeners.forEach((cb) => {
    try { cb(event); } catch {}
  });
}

export function subscribeAuth(cb) {
  _listeners.add(cb);
  return () => _listeners.delete(cb);
}

export async function getStoredAccessToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setStoredAccessToken(token) {
  if (!token) return;
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function setStoredRefreshToken(token) {
  if (!token) return;
  await SecureStore.setItemAsync(REFRESH_KEY, token);
}

/** Salva sessione dopo login/registrazione e notifica l’UI. */
export async function persistAuthSession({ accessToken, refreshToken, user } = {}) {
  if (accessToken) await setStoredAccessToken(accessToken);
  if (refreshToken) await setStoredRefreshToken(refreshToken);
  if (user) await setStoredUserProfile(user);
  notifyListeners({ type: "auth-updated" });
}

export async function getStoredRefreshToken() {
  return SecureStore.getItemAsync(REFRESH_KEY);
}

export async function clearStoredAuth(reason = "session_expired") {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
  notifyListeners({ type: "auth-expired", reason });
}

export async function getStoredUserProfile() {
  const raw = await SecureStore.getItemAsync(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function setStoredUserProfile(user) {
  if (!user) return;
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
  notifyListeners({ type: "user-updated", user });
}

export async function refreshAccessToken() {
  const refreshToken = await getStoredRefreshToken();
  if (!refreshToken) return null;
  let response;
  try {
    response = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    // Rete assente: non cancellare la sessione salvata.
    throw new Error("NETWORK_ERROR");
  }
  if (!response.ok) return null;
  const data = await response.json();
  await setStoredAccessToken(data.accessToken);
  if (data.refreshToken) await setStoredRefreshToken(data.refreshToken);
  return data.accessToken;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const { signal: _ignored, timeoutMs: _t, ...rest } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function apiFetch(path, options = {}) {
  const { timeoutMs = 30000, ...restOptions } = options;

  const makeRequest = async (token) => {
    const headers = {
      ...(restOptions.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    return fetchWithTimeout(
      `${API_BASE}${path}`,
      { ...restOptions, headers },
      timeoutMs,
    );
  };

  let token = await getStoredAccessToken();
  let response = await makeRequest(token);

  if (response.status === 401) {
    try {
      token = await refreshAccessToken();
    } catch {
      return response;
    }
    if (!token) {
      await clearStoredAuth("session_expired");
      return response;
    }
    response = await makeRequest(token);
    if (response.status === 401) {
      await clearStoredAuth("session_expired");
    }
  }

  return response;
}

export async function bootstrapAuth() {
  let token = await getStoredAccessToken();
  const refreshStored = await getStoredRefreshToken();

  if (!token && refreshStored) {
    try {
      token = await refreshAccessToken();
    } catch {
      const profile = await getStoredUserProfile();
      return Boolean(profile || refreshStored);
    }
  }

  if (!token) {
    if (!refreshStored) await clearStoredAuth();
    return false;
  }

  try {
    const res = await apiFetch("/api/users/me");
    if (res.ok) {
      const data = await res.json();
      await setStoredUserProfile({
        id: data.id,
        email: data.email,
        name: data.name,
        avatar_url: data.avatar_url,
        role: data.role,
      });
      notifyListeners({ type: "auth-restored" });
      return true;
    }
    if (res.status === 401 || res.status === 403) {
      try {
        const newToken = await refreshAccessToken();
        if (!newToken) {
          await clearStoredAuth();
          return false;
        }
        const retry = await apiFetch("/api/users/me");
        if (retry.ok) {
          const data = await retry.json();
          await setStoredUserProfile({
            id: data.id,
            email: data.email,
            name: data.name,
            avatar_url: data.avatar_url,
            role: data.role,
          });
          notifyListeners({ type: "auth-restored" });
          return true;
        }
        if (retry.status === 401 || retry.status === 403) {
          await clearStoredAuth();
          return false;
        }
      } catch {
        const profile = await getStoredUserProfile();
        return Boolean(profile);
      }
    }
    // Server offline o errore temporaneo: resta loggato con profilo in cache.
    const profile = await getStoredUserProfile();
    return Boolean(profile || token);
  } catch {
    const profile = await getStoredUserProfile();
    return Boolean(profile || token || refreshStored);
  }
}

export function apiUrl(path) {
  return `${API_BASE}${path}`;
}

export function resolveMediaUrl(path) {
  if (!path) return null;
  if (String(path).startsWith("http")) return path;
  return apiUrl(path);
}
