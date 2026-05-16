import * as Location from "expo-location";

let _watchSub = null;
let _listeners = new Set();
/** @type {{ position: [number, number], heading: number | null, speed: number | null } | null} */
let _lastPosition = null;

/** Coordinate [lat, lon] da snapshot posizione (compat legacy array). */
export function toCoords(snapshot) {
  if (!snapshot) return null;
  if (Array.isArray(snapshot)) return snapshot;
  return Array.isArray(snapshot.position) ? snapshot.position : null;
}

export function getLastKnownPosition() {
  return toCoords(_lastPosition);
}

function notifyFromCoords(coords) {
  const snap = {
    position: [coords.latitude, coords.longitude],
    heading:
      typeof coords.heading === "number" && !Number.isNaN(coords.heading)
        ? coords.heading
        : null,
    speed:
      typeof coords.speed === "number" && !Number.isNaN(coords.speed)
        ? coords.speed
        : null,
  };
  _lastPosition = snap;
  _listeners.forEach((cb) => {
    try {
      cb(snap);
    } catch {
      /* */
    }
  });
}

export function subscribePosition(cb) {
  _listeners.add(cb);
  if (_lastPosition) cb(_lastPosition);
  return () => _listeners.delete(cb);
}

export async function requestPermissions() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === "granted";
}

export async function requestBackgroundPermissions() {
  const { status } = await Location.requestBackgroundPermissionsAsync();
  return status === "granted";
}

export async function getQuickPosition() {
  if (_lastPosition) return toCoords(_lastPosition);
  try {
    const granted = await requestPermissions();
    if (!granted) return null;
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
      timeout: 5000,
    });
    notifyFromCoords(loc.coords);
    return toCoords(_lastPosition);
  } catch {
    return null;
  }
}

export async function startWatching(options = {}) {
  if (_watchSub) return;
  const granted = await requestPermissions();
  if (!granted) return;

  _watchSub = await Location.watchPositionAsync(
    {
      accuracy: options.highAccuracy
        ? Location.Accuracy.BestForNavigation
        : Location.Accuracy.Balanced,
      timeInterval: options.intervalMs || 3000,
      distanceInterval: options.distanceM || 5,
    },
    (loc) => {
      notifyFromCoords(loc.coords);
    },
  );
}

export function stopWatching() {
  if (_watchSub) {
    _watchSub.remove();
    _watchSub = null;
  }
}

export async function startBackgroundTracking(taskName) {
  const bgGranted = await requestBackgroundPermissions();
  if (!bgGranted) return false;

  await Location.startLocationUpdatesAsync(taskName, {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 3000,
    distanceInterval: 5,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Pinewood",
      notificationBody: "Navigazione GPS attiva",
      notificationColor: "#2D4F1E",
    },
    ...(Location.ActivityType
      ? { activityType: Location.ActivityType.Fitness }
      : {}),
  });
  return true;
}

export async function stopBackgroundTracking(taskName) {
  const isRegistered = await Location.hasStartedLocationUpdatesAsync(taskName);
  if (isRegistered) {
    await Location.stopLocationUpdatesAsync(taskName);
  }
}
