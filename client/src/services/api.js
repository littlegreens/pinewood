function detectApiBase() {
  // Explicit override (useful for dedicated API domains in production).
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  // Default: same-origin. In dev Vite proxy forwards /api and /uploads.
  return "";
}

const API_BASE = detectApiBase();

function getStoredAccessToken() {
  return localStorage.getItem("pinewood_access_token");
}

function setStoredAccessToken(token) {
  if (!token) return;
  localStorage.setItem("pinewood_access_token", token);
}

export function clearStoredAuth(reason = "session_expired") {
  localStorage.removeItem("pinewood_access_token");
  localStorage.removeItem("pinewood_user");
  window.dispatchEvent(
    new CustomEvent("pinewood-auth-expired", {
      detail: { reason, message: "Sessione scaduta, effettua di nuovo il login" },
    })
  );
  window.dispatchEvent(new Event("pinewood-user-updated"));
}

export function setStoredUserProfile(user) {
  if (!user) return;
  localStorage.setItem("pinewood_user", JSON.stringify(user));
  window.dispatchEvent(new Event("pinewood-user-updated"));
}

export async function refreshAccessToken() {
  const response = await fetch(`${API_BASE}/api/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) return null;
  const data = await response.json();
  setStoredAccessToken(data.accessToken);
  return data.accessToken;
}

export async function apiFetch(path, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const isTrailDelete = method === "DELETE" && /^\/api\/trails\/[^/]+$/i.test(String(path || ""));
  const makeRequest = async (token) => {
    const headers = {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    if (isTrailDelete) {
      console.info("[delete trail] request", { path, hasAccessToken: Boolean(token) });
    }
    return fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      credentials: "include",
    });
  };

  let token = getStoredAccessToken();
  let response;
  try {
    response = await makeRequest(token);
  } catch (error) {
    if (isTrailDelete) {
      console.error("[delete trail] network error before first response", {
        message: error?.message || String(error),
      });
    }
    throw error;
  }
  if (isTrailDelete) {
    console.info("[delete trail] first response", { status: response.status });
  }

  if (response.status === 401) {
    if (isTrailDelete) {
      console.warn("[delete trail] 401, trying refresh");
    }
    token = await refreshAccessToken();
    if (!token) {
      if (isTrailDelete) {
        console.error("[delete trail] refresh failed: no token");
      }
      clearStoredAuth();
      return response;
    }
    try {
      response = await makeRequest(token);
    } catch (error) {
      if (isTrailDelete) {
        console.error("[delete trail] network error after refresh", {
          message: error?.message || String(error),
        });
      }
      throw error;
    }
    if (isTrailDelete) {
      console.info("[delete trail] response after refresh", { status: response.status });
    }
    if (response.status === 401) {
      clearStoredAuth();
    }
  }

  return response;
}

async function syncStoredUserProfile() {
  try {
    const res = await apiFetch("/api/users/me");
    if (!res.ok) return false;
    const data = await res.json();
    setStoredUserProfile({
      id: data.id,
      email: data.email,
      name: data.name,
      avatar_url: data.avatar_url,
      role: data.role,
    });
    return true;
  } catch {
    /* rete / parsing */
    return false;
  }
}

/**
 * Dopo F5: se manca il JWT ma c’è il cookie refresh, ripristina token e profilo in localStorage.
 * Se c’è il token ma manca pinewood_user (storage parziale), ricarica il profilo.
 */
export async function bootstrapAuth() {
  if (getStoredAccessToken()) {
    const ok = await syncStoredUserProfile();
    if (!ok) {
      const token = await refreshAccessToken();
      if (!token) {
        clearStoredAuth();
        return false;
      }
      const synced = await syncStoredUserProfile();
      if (!synced) {
        clearStoredAuth();
        return false;
      }
    }
    return true;
  }
  const token = await refreshAccessToken();
  if (!token) {
    clearStoredAuth();
    return false;
  }
  const synced = await syncStoredUserProfile();
  if (!synced) {
    clearStoredAuth();
    return false;
  }
  return true;
}
