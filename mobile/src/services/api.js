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
  try {
    const refreshToken = await getStoredRefreshToken();
    if (!refreshToken) return null;
    const response = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    await setStoredAccessToken(data.accessToken);
    if (data.refreshToken) await setStoredRefreshToken(data.refreshToken);
    return data.accessToken;
  } catch {
    return null;
  }
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
    token = await refreshAccessToken();
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

async function syncStoredUserProfile() {
  try {
    const res = await apiFetch("/api/users/me");
    if (!res.ok) return false;
    const data = await res.json();
    await setStoredUserProfile({
      id: data.id,
      email: data.email,
      name: data.name,
      avatar_url: data.avatar_url,
      role: data.role,
    });
    return true;
  } catch {
    return false;
  }
}

export async function bootstrapAuth() {
  const token = await getStoredAccessToken();
  if (token) {
    const ok = await syncStoredUserProfile();
    if (!ok) {
      const newToken = await refreshAccessToken();
      if (!newToken) {
        await clearStoredAuth();
        return false;
      }
      const synced = await syncStoredUserProfile();
      if (!synced) {
        await clearStoredAuth();
        return false;
      }
    }
    return true;
  }
  await clearStoredAuth();
  return false;
}

export function apiUrl(path) {
  return `${API_BASE}${path}`;
}

export function resolveMediaUrl(path) {
  if (!path) return null;
  if (String(path).startsWith("http")) return path;
  return apiUrl(path);
}
