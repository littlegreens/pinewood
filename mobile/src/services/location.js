import * as Location from "expo-location";
import { getBackgroundLocationConfig } from "./batteryManager";

let _watchSub = null;
let _headingSub = null;
/** Ultima lettura bussola (trueHeading preferito). */
let _compassHeading = null;
let _listeners = new Set();
/** @type {{ position: [number, number], heading: number | null, compassHeading: number | null, speed: number | null, accuracy: number | null } | null} */
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

function notifyListeners() {
  if (!_lastPosition) return;
  _listeners.forEach((cb) => {
    try {
      cb(_lastPosition);
    } catch {
      /* */
    }
  });
}

function notifyFromCoords(coords) {
  _lastPosition = {
    position: [coords.latitude, coords.longitude],
    heading:
      typeof coords.heading === "number" && !Number.isNaN(coords.heading)
        ? coords.heading
        : null,
    compassHeading:
      typeof _compassHeading === "number" && !Number.isNaN(_compassHeading)
        ? _compassHeading
        : null,
    speed:
      typeof coords.speed === "number" && !Number.isNaN(coords.speed)
        ? coords.speed
        : null,
    accuracy:
      typeof coords.accuracy === "number" && !Number.isNaN(coords.accuracy)
        ? coords.accuracy
        : null,
  };
  notifyListeners();
}

function notifyCompass(headingDeg) {
  if (typeof headingDeg !== "number" || Number.isNaN(headingDeg) || headingDeg < 0) {
    return;
  }
  _compassHeading = ((headingDeg % 360) + 360) % 360;
  if (_lastPosition) {
    _lastPosition = { ..._lastPosition, compassHeading: _compassHeading };
    notifyListeners();
  }
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

  // Bussola magnetica: usata a bassa velocità (fermo / passo lento).
  if (!_headingSub && typeof Location.watchHeadingAsync === "function") {
    try {
      _headingSub = await Location.watchHeadingAsync((obj) => {
        const trueH = obj?.trueHeading;
        const magH = obj?.magHeading;
        const h =
          typeof trueH === "number" && trueH >= 0
            ? trueH
            : typeof magH === "number" && magH >= 0
              ? magH
              : null;
        if (h != null) notifyCompass(h);
      });
    } catch {
      _headingSub = null;
    }
  }
}

export function stopWatching() {
  if (_watchSub) {
    _watchSub.remove();
    _watchSub = null;
  }
  if (_headingSub) {
    _headingSub.remove();
    _headingSub = null;
  }
}

export async function startBackgroundTracking(taskName) {
  const bgGranted = await requestBackgroundPermissions();
  if (!bgGranted) return false;

  const bg = getBackgroundLocationConfig();
  await Location.startLocationUpdatesAsync(taskName, {
    accuracy: bg.accuracy,
    timeInterval: bg.timeInterval,
    distanceInterval: bg.distanceInterval,
    deferredUpdatesInterval: bg.deferredUpdatesInterval,
    deferredUpdatesDistance: bg.deferredUpdatesDistance,
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
