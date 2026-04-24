const LAST_LOCATION_KEY = "pinewood_last_location";

let watchId = null;
let listeners = new Set();
let lastSnapshot = null;

function hydrateLastSnapshot() {
  if (lastSnapshot) return;
  try {
    const raw = sessionStorage.getItem(LAST_LOCATION_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (
      Array.isArray(parsed?.position) &&
      parsed.position.length === 2 &&
      Number.isFinite(parsed.position[0]) &&
      Number.isFinite(parsed.position[1]) &&
      Number.isFinite(parsed.ts)
    ) {
      lastSnapshot = parsed;
    }
  } catch {
    // ignore corrupted storage payload
  }
}

function persistSnapshot(snapshot) {
  lastSnapshot = snapshot;
  try {
    sessionStorage.setItem(LAST_LOCATION_KEY, JSON.stringify(snapshot));
  } catch {
    // best effort only
  }
  listeners.forEach((cb) => {
    try {
      cb(snapshot);
    } catch {
      // isolate listener errors
    }
  });
}

export function getLastKnownLocation() {
  hydrateLastSnapshot();
  return lastSnapshot?.position || null;
}

export function subscribeLocation(listener) {
  listeners.add(listener);
  if (lastSnapshot) listener(lastSnapshot);
  return () => listeners.delete(listener);
}

export function startBackgroundLocationTracking() {
  hydrateLastSnapshot();
  if (!navigator.geolocation || watchId != null) return;
  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      persistSnapshot({
        position: [pos.coords.latitude, pos.coords.longitude],
        accuracy: pos.coords.accuracy ?? null,
        ts: Date.now(),
      });
    },
    () => {
      // user can deny: keep app running without hard failure
    },
    {
      enableHighAccuracy: false,
      maximumAge: 60_000,
      timeout: 15_000,
    }
  );
}

export function stopBackgroundLocationTracking() {
  if (watchId == null || !navigator.geolocation) return;
  navigator.geolocation.clearWatch(watchId);
  watchId = null;
}

export async function requestQuickLocation({ timeoutMs = 4500 } = {}) {
  const cached = getLastKnownLocation();
  if (cached) return cached;
  if (!navigator.geolocation) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const snapshot = {
          position: [pos.coords.latitude, pos.coords.longitude],
          accuracy: pos.coords.accuracy ?? null,
          ts: Date.now(),
        };
        persistSnapshot(snapshot);
        resolve(snapshot.position);
      },
      () => resolve(null),
      {
        enableHighAccuracy: false,
        maximumAge: 60_000,
        timeout: timeoutMs,
      }
    );
  });
}

