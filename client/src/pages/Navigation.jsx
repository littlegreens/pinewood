import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { Box, IconButton, Typography } from "@mui/material";
import StopIcon from "@mui/icons-material/Stop";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { detectLanguage, t } from "../services/i18n.js";
import { apiFetch } from "../services/api.js";
import {
  playOffRouteBeep,
  vibrateOffRoute,
  vibrateOffRoutePulse,
} from "../services/navigationAlerts.js";
import { subscribeLocation } from "../services/locationTracker.js";
import {
  exitDocumentFullscreen,
  isDocumentFullscreenActive,
  lockPortraitOrientation,
} from "../utils/screenChrome.js";
import AppBanner from "../components/AppBanner.jsx";
import { buildElevationProfilePath as buildElevationProfilePathBase } from "../utils/elevationProfilePath.js";

const OFF_ROUTE_VIBRATE_PULSE_MS = 900;
const NAV_RUNTIME_STATE_KEY_PREFIX = "pinewood_nav_runtime_";
/** Fuori traccia: lascia margine ampio (GPS + sentiero largo). */
const OFF_ROUTE_ENTER_M = 60;
const OFF_ROUTE_EXIT_M = 42;
const OFF_ROUTE_ENTER_DELAY_MS = 6000;
const OFF_ROUTE_EXIT_DELAY_MS = 3500;
const GPS_MAX_ACCURACY_TRUST_M = 55;
const OFF_ROUTE_ENTER_MIN_SAMPLES = 3;
/** Aggiorna heading in React solo sopra questa soglia (°) → meno scatti sulla mappa. */
const HEADING_PUBLISH_MIN_DELTA_DEG = 4;
/** Posizione mappa: non ogni fix GPS. */
const POS_PUBLISH_MIN_M = 5;
const POS_PUBLISH_MIN_MS = 350;
/** Sotto ~1.5 km/h: bussola magnetica; sopra: GPS bearing di movimento. */
const COMPASS_MAX_SPEED_MS = 1.5 / 3.6;

const OFFLINE_TRAIL_KEY_PREFIX = "pw_trail_";
const LEGACY_OFFLINE_TRAIL_KEY_PREFIX = "pinewood_offline_trail_";

function MapReadyBridge({ onReady }) {
  const map = useMap();
  useEffect(() => {
    onReady(map);
  }, [map, onReady]);
  return null;
}

function bearingDeg(a, b) {
  const φ1 = (a[0] * Math.PI) / 180;
  const φ2 = (b[0] * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function normalizeAngleDeg(v) {
  return ((v % 360) + 360) % 360;
}

function shortestAngleDeltaDeg(from, to) {
  const a = normalizeAngleDeg(from);
  const b = normalizeAngleDeg(to);
  let d = b - a;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

function smoothHeadingDeg(prev, next, alpha = 0.22) {
  if (typeof prev !== "number" || Number.isNaN(prev)) return normalizeAngleDeg(next);
  if (typeof next !== "number" || Number.isNaN(next)) return normalizeAngleDeg(prev);
  const delta = shortestAngleDeltaDeg(prev, next);
  return normalizeAngleDeg(prev + delta * alpha);
}

const USER_MARKER_ICON = L.divIcon({
  className: "pinewood-nav-user-icon",
  html: `<div class="pinewood-nav-user-rot" style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4))"><svg width="30" height="30" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#e8c85c" stroke="#3a3a3a" stroke-width="1" stroke-linejoin="round" d="M12 3 L21 20 L12 15.5 L3 20 Z"/></svg></div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

/** Freccia: punta dove guardi. La mappa resta nord-up, gesti Leaflet nativi. */
function NavigationUserMarker({ position, headingDeg }) {
  const markerRef = useRef(null);
  useEffect(() => {
    const el = markerRef.current?.getElement?.();
    const rot = el?.querySelector?.(".pinewood-nav-user-rot");
    if (!rot) return;
    const deg = typeof headingDeg === "number" && !Number.isNaN(headingDeg) ? headingDeg : 0;
    rot.style.transform = `rotate(${deg}deg)`;
  }, [headingDeg, position]);
  return <Marker ref={markerRef} position={position} icon={USER_MARKER_ICON} />;
}

function isLeafletMapUsable(map) {
  return Boolean(map && typeof map.stop === "function" && map._loaded && map._mapPane);
}

export default function Navigation() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const lang = useMemo(() => detectLanguage(), []);
  const [line, setLine] = useState([]);
  const [position, setPosition] = useState(() => {
    const p = location.state?.initialPosition;
    if (Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1])) {
      return [p[0], p[1]];
    }
    return null;
  });
  const [pocketMode, setPocketMode] = useState(false);
  const [deviationsCount, setDeviationsCount] = useState(0);
  const [isOffRoute, setIsOffRoute] = useState(false);
  const [actualTrack, setActualTrack] = useState([]);
  const [elevationProfile, setElevationProfile] = useState([]);
  const [parseStatus, setParseStatus] = useState(null);
  const [waypoints, setWaypoints] = useState([]);
  const [userDistanceM, setUserDistanceM] = useState(null);
  const [mapInstance, setMapInstance] = useState(null);
  const [userHeading, setUserHeading] = useState(null);
  const prevPosRef = useRef(null);
  const lastHeadingRef = useRef(null);
  const publishedHeadingRef = useRef(null);
  const compassHeadingRef = useRef(null);
  const lastSpeedRef = useRef(null);
  const pocketTouchStartY = useRef(null);
  const lockDragOffsetYRef = useRef(0);
  const [lockDragOffsetY, setLockDragOffsetY] = useState(0);
  const [lockDragging, setLockDragging] = useState(false);
  const wasOffRouteRef = useRef(false);
  const lastOffRoutePulseAtRef = useRef(0);
  const lastOffRouteVoiceAtRef = useRef(0);
  const positionAccuracyRef = useRef(null);
  const offRouteEnterSamplesRef = useRef(0);
  const wakeLockRef = useRef(null);
  const pocketLayerRef = useRef(null);
  const [pocketIntroOpen, setPocketIntroOpen] = useState(false);
  const [pocketIntroSkipChecked, setPocketIntroSkipChecked] = useState(false);
  /** In tasca: schermo visivamente più scuro fino al primo tocco (non è la luminosità di sistema). */
  const [pocketVisualAwake, setPocketVisualAwake] = useState(false);
  /** Navigazione attiva subito: niente gate distanza / GPS obbligatorio. */
  const [startGate, setStartGate] = useState("ready");
  const [fullscreenActive, setFullscreenActive] = useState(false);
  const [chromeUnlocked, setChromeUnlocked] = useState(false);
  const runtimeHydratedRef = useRef(false);
  const unlockTouchStartYRef = useRef(null);
  const unlockDragOffsetYRef = useRef(0);
  const [unlockDragOffsetY, setUnlockDragOffsetY] = useState(0);
  const [unlockDragging, setUnlockDragging] = useState(false);
  const pendingOffRouteSinceRef = useRef(null);
  const pendingOnRouteSinceRef = useRef(null);
  const centeredOnStartRef = useRef(false);
  const userPannedRef = useRef(false);
  const lastPositionPublishAtRef = useRef(0);
  const lastPublishedPosRef = useRef(null);
  const actualTrackRef = useRef([]);
  const deviationsCountRef = useRef(0);
  const [loadError, setLoadError] = useState("");
  const isOfflineLocalSession = useMemo(
    () => String(sessionId || "").startsWith("local_") || location.state?.offlineSession === true,
    [sessionId, location.state]
  );

  function navRuntimeStateKey() {
    return `${NAV_RUNTIME_STATE_KEY_PREFIX}${sessionId}`;
  }

  function offlineTrailStorageKey(trailId) {
    return `${OFFLINE_TRAIL_KEY_PREFIX}${String(trailId)}`;
  }

  function legacyOfflineTrailStorageKey(trailId) {
    return `${LEGACY_OFFLINE_TRAIL_KEY_PREFIX}${String(trailId)}`;
  }

  function getOfflineTrailPayload() {
    const fromState = location.state?.offlineTrail;
    if (fromState?.geom_geojson?.coordinates?.length) return fromState;
    const trailIdFromState = location.state?.trailId;
    if (!trailIdFromState) return null;
    const raw =
      localStorage.getItem(offlineTrailStorageKey(trailIdFromState)) ||
      localStorage.getItem(legacyOfflineTrailStorageKey(trailIdFromState));
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      localStorage.removeItem(offlineTrailStorageKey(trailIdFromState));
      return null;
    }
  }

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    // Play a tutto schermo app, ma URL browser resta (niente document fullscreen / pocket lock).
    exitDocumentFullscreen();
    if (location.state?.fromTrailDetail) {
      lockPortraitOrientation();
    }
  }, [location.state]);

  function distanceMeters(a, b) {
    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(b[0] - a[0]);
    const dLon = toRad(b[1] - a[1]);
    const lat1 = toRad(a[0]);
    const lat2 = toRad(b[0]);
    const x =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  function toLocalXYMeters(point, originLat) {
    const latFactor = 111320;
    const lonFactor = 111320 * Math.cos((originLat * Math.PI) / 180);
    return { x: point[1] * lonFactor, y: point[0] * latFactor };
  }

  function pointProjectionOnSegment(point, segA, segB) {
    const originLat = (segA[0] + segB[0]) / 2;
    const p = toLocalXYMeters(point, originLat);
    const a = toLocalXYMeters(segA, originLat);
    const b = toLocalXYMeters(segB, originLat);
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const apx = p.x - a.x;
    const apy = p.y - a.y;
    const abLenSq = abx * abx + aby * aby;
    const t = abLenSq > 0 ? Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLenSq)) : 0;
    const cx = a.x + t * abx;
    const cy = a.y + t * aby;
    const dx = p.x - cx;
    const dy = p.y - cy;
    const closest = [
      segA[0] + (segB[0] - segA[0]) * t,
      segA[1] + (segB[1] - segA[1]) * t,
    ];
    return { distance: Math.sqrt(dx * dx + dy * dy), t, closest };
  }

  useEffect(() => {
    const unsub = subscribeLocation((snapshot) => {
      if (!snapshot?.position) return;
      setPosition((prev) => prev || snapshot.position);
    });
    let watchId;
    let cancelled = false;
    let orientationAttached = false;
    prevPosRef.current = null;
    lastHeadingRef.current = null;
    publishedHeadingRef.current = null;
    compassHeadingRef.current = null;
    lastSpeedRef.current = null;
    setUserHeading(null);

    function publishHeading(h) {
      if (typeof h !== "number" || Number.isNaN(h)) {
        publishedHeadingRef.current = null;
        setUserHeading(h);
        return;
      }
      const pub = publishedHeadingRef.current;
      if (pub == null || Math.abs(shortestAngleDeltaDeg(pub, h)) >= HEADING_PUBLISH_MIN_DELTA_DEG) {
        publishedHeadingRef.current = h;
        setUserHeading(h);
      }
    }

    function onDeviceOrientation(ev) {
      let compass = null;
      if (typeof ev.webkitCompassHeading === "number" && !Number.isNaN(ev.webkitCompassHeading)) {
        compass = ev.webkitCompassHeading;
      } else if (typeof ev.alpha === "number" && !Number.isNaN(ev.alpha)) {
        compass = (360 - ev.alpha + 360) % 360;
      }
      if (compass == null) return;
      compassHeadingRef.current = compass;
      const speed = lastSpeedRef.current;
      const movingFast =
        typeof speed === "number" && !Number.isNaN(speed) && speed >= COMPASS_MAX_SPEED_MS;
      if (movingFast) return;
      const smoothed = smoothHeadingDeg(lastHeadingRef.current, compass);
      lastHeadingRef.current = smoothed;
      publishHeading(smoothed);
    }

    async function attachCompass() {
      try {
        const DOE = window.DeviceOrientationEvent;
        if (DOE && typeof DOE.requestPermission === "function") {
          const perm = await DOE.requestPermission();
          if (perm !== "granted") return;
        }
      } catch {
        return;
      }
      if (cancelled || orientationAttached) return;
      const absEvt = "ondeviceorientationabsolute" in window ? "deviceorientationabsolute" : "deviceorientation";
      window.addEventListener(absEvt, onDeviceOrientation, true);
      orientationAttached = absEvt;
    }
    void attachCompass();

    async function load() {
      if (cancelled) return;
      if (isOfflineLocalSession) {
        const offlineData = getOfflineTrailPayload();
        const coords = offlineData?.geom_geojson?.coordinates || [];
        if (!coords.length) {
          const target = location.state?.trailId ? `/app/trails/${location.state.trailId}` : "/app";
          if (cancelled) return;
          navigate(target, { replace: true });
          return;
        }
        if (cancelled) return;
        setLine(coords.map(([lon, lat]) => [lat, lon]));
        setElevationProfile(Array.isArray(offlineData?.elevation_profile) ? offlineData.elevation_profile : []);
        setParseStatus(offlineData?.parse_status || null);
        setWaypoints(Array.isArray(offlineData?.waypoints) ? offlineData.waypoints : []);
      } else {
        const res = await apiFetch(`/api/sessions/${sessionId}`);
        if (cancelled) return;
        if (res.status === 401) {
          navigate("/");
          return;
        }
        if (!res.ok) {
          setLoadError(t(lang, "navLoadFailed"));
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        const coords = data?.geom_geojson?.coordinates || [];
        if (!coords.length) {
          setLoadError(t(lang, "trailNoGeometry"));
          return;
        }
        setLoadError("");
        setLine(coords.map(([lon, lat]) => [lat, lon]));
        setElevationProfile(Array.isArray(data?.elevation_profile) ? data.elevation_profile : []);
        setParseStatus(data?.parse_status || null);
        setWaypoints(Array.isArray(data?.waypoints) ? data.waypoints : []);
      }
      if (cancelled) return;
      watchId = navigator.geolocation.watchPosition(
        (p) => {
          if (cancelled) return;
          const lat = p.coords.latitude;
          const lon = p.coords.longitude;
          const pos = [lat, lon];
          positionAccuracyRef.current =
            typeof p.coords.accuracy === "number" && !Number.isNaN(p.coords.accuracy)
              ? p.coords.accuracy
              : null;
          let h = null;
          const speed = p.coords.speed;
          lastSpeedRef.current =
            typeof speed === "number" && !Number.isNaN(speed) ? speed : null;
          const movingFast =
            typeof speed === "number" && !Number.isNaN(speed) && speed >= COMPASS_MAX_SPEED_MS;
          if (movingFast) {
            if (
              typeof p.coords.heading === "number" &&
              !Number.isNaN(p.coords.heading) &&
              p.coords.heading >= 0
            ) {
              h = p.coords.heading;
            } else if (prevPosRef.current) {
              const moved = distanceMeters(prevPosRef.current, pos);
              if (moved > 4) h = bearingDeg(prevPosRef.current, pos);
            }
          } else if (typeof compassHeadingRef.current === "number") {
            h = compassHeadingRef.current;
          } else if (
            typeof p.coords.heading === "number" &&
            !Number.isNaN(p.coords.heading) &&
            p.coords.heading >= 0 &&
            (speed == null || speed > 0.35)
          ) {
            h = p.coords.heading;
          } else if (prevPosRef.current) {
            const moved = distanceMeters(prevPosRef.current, pos);
            if (moved > 4) h = bearingDeg(prevPosRef.current, pos);
          }
          if (h == null) {
            h = lastHeadingRef.current;
          } else {
            const smoothed = smoothHeadingDeg(lastHeadingRef.current, h);
            lastHeadingRef.current = smoothed;
            h = smoothed;
          }
          prevPosRef.current = pos;
          const nowTs = Date.now();
          const movedEnough =
            !lastPublishedPosRef.current ||
            distanceMeters(lastPublishedPosRef.current, pos) >= POS_PUBLISH_MIN_M;
          if (movedEnough || nowTs - (lastPositionPublishAtRef.current || 0) >= POS_PUBLISH_MIN_MS) {
            lastPositionPublishAtRef.current = nowTs;
            lastPublishedPosRef.current = pos;
            setPosition(pos);
          }
          publishHeading(h);
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 12_000 }
      );
    }
    load();
    return () => {
      cancelled = true;
      unsub?.();
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      if (orientationAttached) {
        window.removeEventListener(orientationAttached, onDeviceOrientation, true);
      }
    };
  }, [sessionId, navigate, isOfflineLocalSession, location.state]);

  const center = line[0] || [41.9, 12.5];
  const cumulativeDistances = useMemo(() => {
    if (line.length === 0) return [0];
    const out = [0];
    for (let i = 1; i < line.length; i += 1) {
      out.push(out[i - 1] + distanceMeters(line[i - 1], line[i]));
    }
    return out;
  }, [line]);

  const trailProjection = useMemo(() => {
    if (startGate !== "ready" || !position || line.length === 0) return null;
    if (line.length === 1) {
      return {
        minSegDist: distanceMeters(position, line[0]),
        bestAlong: 0,
        nearestPoint: line[0],
      };
    }
    let minSegDist = Number.POSITIVE_INFINITY;
    let bestAlong = 0;
    let nearestPoint = line[0];
    for (let i = 0; i < line.length - 1; i += 1) {
      const segLen = Math.max(0, cumulativeDistances[i + 1] - cumulativeDistances[i]);
      const { distance, t, closest } = pointProjectionOnSegment(position, line[i], line[i + 1]);
      const along = cumulativeDistances[i] + segLen * t;
      if (distance < minSegDist - 1 || (Math.abs(distance - minSegDist) <= 1 && along < bestAlong)) {
        minSegDist = distance;
        bestAlong = along;
        nearestPoint = closest;
      }
    }
    return { minSegDist, bestAlong, nearestPoint };
  }, [startGate, position, line, cumulativeDistances]);

  const offRouteReconnectLine = useMemo(() => {
    if (!isOffRoute || !position || !trailProjection?.nearestPoint) return null;
    return [position, trailProjection.nearestPoint];
  }, [isOffRoute, position, trailProjection]);

  const offRouteBannerText = useMemo(() => {
    if (!isOffRoute || !trailProjection) return "";
    // Arrotonda a 5 m: meno re-render del banner mentre cammini fuori traccia.
    const meters = Math.max(5, Math.round(trailProjection.minSegDist / 5) * 5);
    return t(lang, "navOffRouteAlertMeters").replace("{m}", String(meters));
  }, [isOffRoute, trailProjection, lang]);

  useEffect(() => {
    if (!trailProjection) return;
    const { minSegDist, bestAlong } = trailProjection;
    setUserDistanceM((prev) =>
      prev != null && Math.abs(prev - bestAlong) < 8 ? prev : bestAlong
    );
    const now = Date.now();
    const currentlyOff = wasOffRouteRef.current;
    const accuracy = positionAccuracyRef.current;
    const gpsTrustworthy =
      accuracy == null || !Number.isFinite(accuracy) || accuracy <= GPS_MAX_ACCURACY_TRUST_M;

    const repeatOffRouteAlerts = () => {
      if (now - lastOffRoutePulseAtRef.current >= OFF_ROUTE_VIBRATE_PULSE_MS) {
        lastOffRoutePulseAtRef.current = now;
        vibrateOffRoutePulse();
      }
      // Evita setState a ogni fix GPS se già off-route (blocca la mappa).
      if (!currentlyOff) setIsOffRoute(true);
    };

    if (!gpsTrustworthy) {
      if (currentlyOff) repeatOffRouteAlerts();
      return;
    }

    if (!currentlyOff && minSegDist > OFF_ROUTE_ENTER_M) {
      offRouteEnterSamplesRef.current += 1;
      if (!pendingOffRouteSinceRef.current) pendingOffRouteSinceRef.current = now;
      if (
        offRouteEnterSamplesRef.current >= OFF_ROUTE_ENTER_MIN_SAMPLES &&
        now - pendingOffRouteSinceRef.current >= OFF_ROUTE_ENTER_DELAY_MS
      ) {
        wasOffRouteRef.current = true;
        pendingOffRouteSinceRef.current = null;
        pendingOnRouteSinceRef.current = null;
        offRouteEnterSamplesRef.current = 0;
        setIsOffRoute(true);
        lastOffRoutePulseAtRef.current = now;
        lastOffRouteVoiceAtRef.current = now;
        setDeviationsCount((v) => v + 1);
        playOffRouteBeep();
        vibrateOffRoute();
      }
    } else if (currentlyOff && minSegDist < OFF_ROUTE_EXIT_M) {
      offRouteEnterSamplesRef.current = 0;
      if (!pendingOnRouteSinceRef.current) pendingOnRouteSinceRef.current = now;
      if (now - pendingOnRouteSinceRef.current >= OFF_ROUTE_EXIT_DELAY_MS) {
        wasOffRouteRef.current = false;
        pendingOnRouteSinceRef.current = null;
        pendingOffRouteSinceRef.current = null;
        lastOffRoutePulseAtRef.current = 0;
        lastOffRouteVoiceAtRef.current = 0;
        setIsOffRoute(false);
      }
    } else if (currentlyOff) {
      offRouteEnterSamplesRef.current = 0;
      pendingOnRouteSinceRef.current = null;
      repeatOffRouteAlerts();
    } else {
      offRouteEnterSamplesRef.current = 0;
      pendingOffRouteSinceRef.current = null;
      // Non chiamare setState se già on-route (evita scatti/freeze).
    }
  }, [trailProjection, lang]);

  useEffect(() => {
    setStartGate("ready");
    setPocketMode(false);
    publishedHeadingRef.current = null;
    setActualTrack([]);
    setDeviationsCount(0);
    setIsOffRoute(false);
    wasOffRouteRef.current = false;
    pendingOffRouteSinceRef.current = null;
    pendingOnRouteSinceRef.current = null;
    offRouteEnterSamplesRef.current = 0;
    lastOffRouteVoiceAtRef.current = 0;
    setUserDistanceM(null);
  }, [sessionId]);

  useEffect(() => {
    if (startGate !== "ready") {
      wakeLockRef.current?.release?.().catch(() => {});
      wakeLockRef.current = null;
      return;
    }
    let cancelled = false;
    async function acquire() {
      try {
        if (!("wakeLock" in navigator)) return;
        const wl = await navigator.wakeLock.request("screen");
        if (cancelled) {
          wl.release().catch(() => {});
          return;
        }
        wakeLockRef.current = wl;
      } catch {
        /* permesso negato o non supportato */
      }
    }
    acquire();
    function onVisibility() {
      if (document.visibilityState !== "visible") return;
      wakeLockRef.current?.release?.().catch(() => {});
      wakeLockRef.current = null;
      acquire();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      wakeLockRef.current?.release?.().catch(() => {});
      wakeLockRef.current = null;
    };
  }, [sessionId, startGate]);

  useEffect(() => {
    if (startGate !== "ready") return;
    exitDocumentFullscreen();
    lockPortraitOrientation();
  }, [startGate]);

  useEffect(() => {
    runtimeHydratedRef.current = false;
    try {
      const raw = sessionStorage.getItem(navRuntimeStateKey());
      if (!raw) {
        runtimeHydratedRef.current = true;
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.actualTrack)) setActualTrack(parsed.actualTrack);
      if (typeof parsed.deviationsCount === "number") setDeviationsCount(parsed.deviationsCount);
      if (typeof parsed.isOffRoute === "boolean") {
        setIsOffRoute(parsed.isOffRoute);
        wasOffRouteRef.current = parsed.isOffRoute;
      }
      if (typeof parsed.userDistanceM === "number") setUserDistanceM(parsed.userDistanceM);
      if (typeof parsed.userHeading === "number") {
        setUserHeading(parsed.userHeading);
        lastHeadingRef.current = parsed.userHeading;
        publishedHeadingRef.current = parsed.userHeading;
      }
      // Gate distanza rimosso: forza sempre ready anche su snapshot vecchi.
      setStartGate("ready");
      if (typeof parsed.pocketMode === "boolean") setPocketMode(parsed.pocketMode);
      if (typeof parsed.chromeUnlocked === "boolean") setChromeUnlocked(parsed.chromeUnlocked);
    } catch {
      /* ignore corrupted runtime snapshot */
    } finally {
      runtimeHydratedRef.current = true;
    }
  }, [sessionId]);

  useEffect(() => {
    if (!runtimeHydratedRef.current) return;
    const key = navRuntimeStateKey();
    const write = () => {
      const snapshot = {
        deviationsCount,
        actualTrack: actualTrackRef.current,
        isOffRoute,
        userDistanceM,
        userHeading,
        startGate,
        pocketMode,
        chromeUnlocked,
        updatedAt: Date.now(),
      };
      try {
        sessionStorage.setItem(key, JSON.stringify(snapshot));
      } catch {
        /* ignore quota/storage issues */
      }
    };
    // Heading cambia spesso: debounce per non bloccare il main thread / mappa.
    const delay = userHeading != null ? 400 : 0;
    const t = setTimeout(write, delay);
    return () => clearTimeout(t);
  }, [
    sessionId,
    deviationsCount,
    actualTrack,
    isOffRoute,
    userDistanceM,
    userHeading,
    startGate,
    pocketMode,
    chromeUnlocked,
  ]);

  useEffect(() => {
    function syncFs() {
      setFullscreenActive(isDocumentFullscreenActive());
    }
    syncFs();
    document.addEventListener("fullscreenchange", syncFs);
    document.addEventListener("webkitfullscreenchange", syncFs);
    return () => {
      document.removeEventListener("fullscreenchange", syncFs);
      document.removeEventListener("webkitfullscreenchange", syncFs);
    };
  }, []);

  /** Safari: barra di stato sul contenuto; il vero fullscreen non è disponibile per i siti. */
  useEffect(() => {
    const meta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    const prev = meta?.getAttribute("content") ?? "default";
    meta?.setAttribute("content", "black-translucent");
    return () => {
      meta?.setAttribute("content", prev);
    };
  }, []);

  useEffect(() => {
    return () => {
      exitDocumentFullscreen();
    };
  }, []);

  useEffect(() => {
    if (!pocketMode) return;
    const node = pocketLayerRef.current;
    if (!node) return;
    const block = (e) => {
      e.preventDefault();
    };
    node.addEventListener("touchmove", block, { passive: false, capture: true });
    node.addEventListener("wheel", block, { passive: false, capture: true });
    node.addEventListener("gesturestart", block, { passive: false, capture: true });
    return () => {
      node.removeEventListener("touchmove", block, { capture: true });
      node.removeEventListener("wheel", block, { capture: true });
      node.removeEventListener("gesturestart", block, { capture: true });
    };
  }, [pocketMode]);

  useEffect(() => {
    if (!pocketMode) return;
    const body = document.body;
    const prevBodyTA = body.style.touchAction;
    body.style.touchAction = "none";
    return () => {
      body.style.touchAction = prevBodyTA;
    };
  }, [pocketMode]);

  // Camera iniziale una sola volta per traccia: setView senza nascondere la polyline.
  useEffect(() => {
    if (!mapInstance || line.length === 0) return;
    if (!isLeafletMapUsable(mapInstance)) return;
    centeredOnStartRef.current = false;
    userPannedRef.current = false;

    mapInstance.stop();
    if (position) {
      mapInstance.setView(position, Math.max(mapInstance.getZoom() || 14, 15), { animate: false });
      centeredOnStartRef.current = true;
    } else {
      mapInstance.fitBounds(line, { padding: [18, 18], animate: false });
    }

    const markUserPan = () => {
      userPannedRef.current = true;
    };
    mapInstance.on("dragstart", markUserPan);
    mapInstance.on("zoomstart", markUserPan);
    return () => {
      mapInstance.off("dragstart", markUserPan);
      mapInstance.off("zoomstart", markUserPan);
    };
    // Solo quando cambia la geometria della traccia, non a ogni fix GPS.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapInstance, line]);

  useEffect(() => {
    if (!mapInstance || startGate !== "ready" || !position) return;
    if (!isLeafletMapUsable(mapInstance)) return;
    if (centeredOnStartRef.current) return;
    mapInstance.setView(position, Math.max(mapInstance.getZoom() || 14, 15), { animate: false });
    centeredOnStartRef.current = true;
  }, [mapInstance, startGate, position]);

  useEffect(() => {
    actualTrackRef.current = actualTrack;
  }, [actualTrack]);

  useEffect(() => {
    deviationsCountRef.current = deviationsCount;
  }, [deviationsCount]);

  useEffect(() => {
    if (startGate !== "ready") return;
    if (!position) return;
    setActualTrack((prev) => {
      if (prev.length === 0) return [position];
      const last = prev[prev.length - 1];
      if (distanceMeters(last, position) < 8) return prev;
      // Cap memoria: tieni ultimi ~2500 punti (~20 km a 8 m)
      const next = [...prev, position];
      return next.length > 2500 ? next.slice(next.length - 2500) : next;
    });
  }, [position, startGate]);

  useEffect(() => {
    if (startGate !== "ready") {
      setChromeUnlocked(false);
    }
  }, [startGate, sessionId]);

  // Sync sessione stabile: NON dipende da actualTrack (altrimenti interval si resetta ogni 8 m).
  useEffect(() => {
    if (startGate !== "ready") return;
    if (isOfflineLocalSession) return;
    const interval = setInterval(() => {
      void apiFetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          completion_pct: null,
          deviations_count: deviationsCountRef.current,
          actual_geom: actualTrackRef.current,
        }),
      }).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [sessionId, startGate, isOfflineLocalSession]);

  function buildExitNavigationTarget() {
    const st = location.state;
    const rawOrigin = st?.backTo;
    const trail = st?.trailId;
    const backToOrigin =
      typeof rawOrigin === "string" && rawOrigin.startsWith("/") && !rawOrigin.startsWith("//")
        ? rawOrigin
        : "/app";
    if (trail) {
      return {
        pathname: `/app/trails/${trail}`,
        state: { backTo: backToOrigin },
      };
    }
    return { pathname: backToOrigin, state: null };
  }

  async function finishSession() {
    if (!isOfflineLocalSession) {
      await apiFetch(`/api/sessions/${sessionId}/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          completion_pct: null,
          deviations_count: deviationsCount,
          actual_geom: actualTrack,
        }),
      });
    }
    sessionStorage.removeItem(navRuntimeStateKey());
    const target = buildExitNavigationTarget();
    navigate(target.pathname, { replace: true, state: target.state });
  }

  async function centerOnUser() {
    if (!mapInstance) return;
    if (!isLeafletMapUsable(mapInstance)) return;
    const target = position || (await requestQuickLocation({ timeoutMs: 3500 }));
    if (!target) return;
    userPannedRef.current = false;
    mapInstance.stop();
    mapInstance.setView(target, Math.max(mapInstance.getZoom(), 15), { animate: false });
  }

  function onMapClickZoom(latlng) {
    if (!mapInstance || !latlng) return;
    if (!isLeafletMapUsable(mapInstance)) return;
    // Zoom volutamente meno aggressivo: un livello in meno rispetto al comportamento precedente.
    const targetZoom = Math.min(17, Math.max(13, mapInstance.getZoom() + 1));
    mapInstance.stop();
    mapInstance.flyTo([latlng.lat, latlng.lng], targetZoom, {
      animate: true,
      duration: 0.55,
      easeLinearity: 0.2,
    });
  }

  function buildElevationPath(profile, width, height, pad) {
    const base = buildElevationProfilePathBase(profile, width, height, pad);
    const { minD, maxD, spanD, pad: p, width: w } = base;
    const userX =
      userDistanceM == null
        ? null
        : p + ((Math.min(maxD, Math.max(minD, userDistanceM)) - minD) / spanD) * (w - p * 2);
    const waypointDots = (waypoints || [])
      .filter((wp) => Number.isFinite(wp.distance_from_start_m))
      .map((wp) => ({
        x: p + ((wp.distance_from_start_m - minD) / spanD) * (w - p * 2),
      }));
    return { d: base.d, minE: base.minE, maxE: base.maxE, userX, waypointDots };
  }

  function onLockTouchStart(e) {
    pocketTouchStartY.current = e.touches?.[0]?.clientY ?? null;
    lockDragOffsetYRef.current = 0;
    setLockDragOffsetY(0);
    setLockDragging(true);
  }

  function onLockTouchMove(e) {
    e.preventDefault();
    const startY = pocketTouchStartY.current;
    const currentY = e.touches?.[0]?.clientY;
    if (startY == null || currentY == null) return;
    const delta = currentY - startY;
    const clamped = Math.min(0, Math.max(-180, delta));
    lockDragOffsetYRef.current = clamped;
    setLockDragOffsetY(clamped);
  }

  function onLockTouchEnd() {
    setLockDragging(false);
    const y = lockDragOffsetYRef.current;
    if (y <= -120) {
      setPocketMode(false);
      setLockDragOffsetY(0);
      pocketTouchStartY.current = null;
      return;
    }
    setLockDragOffsetY(0);
    pocketTouchStartY.current = null;
  }

  function requestPocketMode() {
    /* pocket mode disabilitato */
  }

  function confirmPocketIntro() {
    setPocketIntroOpen(false);
  }

  function cancelPocketIntro() {
    setPocketIntroOpen(false);
  }

  function onUnlockTouchStart(e) {
    unlockTouchStartYRef.current = e.touches?.[0]?.clientY ?? null;
    unlockDragOffsetYRef.current = 0;
    setUnlockDragOffsetY(0);
    setUnlockDragging(true);
  }

  function onUnlockTouchMove(e) {
    e.preventDefault();
    const startY = unlockTouchStartYRef.current;
    const currentY = e.touches?.[0]?.clientY;
    if (startY == null || currentY == null) return;
    const delta = currentY - startY;
    const clamped = Math.min(0, Math.max(-120, delta));
    unlockDragOffsetYRef.current = clamped;
    setUnlockDragOffsetY(clamped);
  }

  function onUnlockTouchEnd() {
    setUnlockDragging(false);
    const y = unlockDragOffsetYRef.current;
    if (y <= -80) {
      setChromeUnlocked(true);
      exitDocumentFullscreen();
      setUnlockDragOffsetY(0);
      unlockTouchStartYRef.current = null;
      return;
    }
    setUnlockDragOffsetY(0);
    unlockTouchStartYRef.current = null;
  }

  const elevationBlock =
    parseStatus !== "ready_no_elevation" && elevationProfile.length > 1 ? (
      <>
        {(() => {
          const width = 520;
          const innerH = 92;
          const pad = 8;
          const topGap = 16;
          const path = buildElevationPath(elevationProfile, width, innerH, pad);
          const triHalf = 5;
          const triBaseY = 2;
          const triTipY = 11;
          const svgH = innerH + topGap + 4;
          return (
            <svg viewBox={`0 0 ${width} ${svgH}`} width="100%" height="76" role="img" style={{ display: "block" }}>
              {path.userX != null && (
                <polygon
                  points={`${path.userX - triHalf},${triBaseY} ${path.userX + triHalf},${triBaseY} ${path.userX},${triTipY}`}
                  fill="#ffffff"
                  stroke="rgba(255,255,255,0.4)"
                  strokeWidth="0.6"
                />
              )}
              {path.userX != null && (
                <line
                  x1={path.userX}
                  x2={path.userX}
                  y1={triTipY + 1}
                  y2={svgH - 8}
                  stroke="#ffffff"
                  strokeWidth="1.8"
                  strokeDasharray="6 5"
                  opacity={0.92}
                />
              )}
              <g transform={`translate(0, ${topGap})`}>
                <path d={path.d} fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
                {path.waypointDots.map((dot, idx) => (
                  <circle key={idx} cx={dot.x} cy={innerH * 0.55} r="2.8" fill="#c9a84c" />
                ))}
                <text x="6" y={innerH - 4} fontSize="11" fill="#dfe8df">
                  {path.minE}m
                </text>
                <text x={width - 54} y="10" fontSize="11" fill="#dfe8df" dominantBaseline="hanging">
                  {path.maxE}m
                </text>
              </g>
            </svg>
          );
        })()}
        <Typography color="#b8c4b8" sx={{ fontSize: "0.78rem", mt: 0.2, px: 0.5, fontWeight: 600 }}>
          {position ? t(lang, "navigationActive") : t(lang, "navWaitingGps")}
        </Typography>
      </>
    ) : (
      <>
        <Typography color="#fff" sx={{ fontWeight: 700, fontSize: "0.95rem", px: 0.6 }}>
          {t(lang, "navigationActive")}
        </Typography>
        <Typography color="#b8c4b8" sx={{ fontSize: "0.8rem", fontWeight: 600, px: 0.6, pb: 0.35 }}>
          {position ? t(lang, "navigationActive") : t(lang, "navWaitingGps")}
        </Typography>
      </>
    );

  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100dvh",
        maxHeight: "100dvh",
        overflow: "hidden",
        bgcolor: "background.default",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        overscrollBehavior: "none",
      }}
    >
      <>
          <Box
            sx={{
              flexShrink: 0,
              bgcolor: "#102115",
              pt: "max(6px, env(safe-area-inset-top))",
              px: 1,
              pb: 0.5,
            }}
          >
            {elevationBlock}
            {isOfflineLocalSession && (
              <Typography
                sx={{
                  mt: 0.4,
                  px: 0.6,
                  color: "#ffdca8",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                }}
              >
                Navigazione offline - sessione non salvata
              </Typography>
            )}
          </Box>

          <Box
            sx={{
              width: "100%",
              flex: 1,
              position: "relative",
              minHeight: 0,
              touchAction: "none",
              "& .leaflet-container": { touchAction: "none", width: "100%", height: "100%" },
            }}
          >
            {startGate === "ready" && (
              <Box
                sx={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: "max(14px, env(safe-area-inset-bottom))",
                  zIndex: 1400,
                  display: "flex",
                  justifyContent: "center",
                  pointerEvents: "none",
                }}
              >
                <IconButton
                  onClick={finishSession}
                  aria-label={t(lang, "completeTrail")}
                  sx={{
                    pointerEvents: "auto",
                    width: 58,
                    height: 58,
                    borderRadius: "50%",
                    bgcolor: "#c62828",
                    color: "#fff",
                    border: "none",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.28)",
                    "&:hover": { bgcolor: "#a31515" },
                  }}
                >
                  <StopIcon sx={{ fontSize: 30, color: "#fff" }} />
                </IconButton>
              </Box>
            )}

            <MapContainer
              center={center}
              zoom={14}
              style={{ width: "100%", height: "100%" }}
              zoomControl={false}
              dragging
              touchZoom
              doubleClickZoom
              scrollWheelZoom
              boxZoom={false}
              keyboard={false}
            >
              <MapReadyBridge onReady={setMapInstance} />
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="" />
              {line.length > 1 && (
                <Polyline
                  positions={line}
                  pathOptions={{
                    color: "#2D4F1E",
                    weight: 5,
                    opacity: 1,
                    lineCap: "round",
                    lineJoin: "round",
                    className: "pinewood-fixed-stroke",
                  }}
                />
              )}
              {actualTrack.length > 1 && (
                <Polyline
                  positions={actualTrack}
                  pathOptions={{
                    color: "#c9a84c",
                    weight: 3,
                    opacity: 0.9,
                    lineCap: "round",
                    lineJoin: "round",
                    className: "pinewood-fixed-stroke",
                  }}
                />
              )}
              {offRouteReconnectLine && (
                <Polyline
                  positions={offRouteReconnectLine}
                  pathOptions={{
                    color: "#ff6b00",
                    weight: 3,
                    opacity: 0.9,
                    dashArray: "10 8",
                    className: "pinewood-fixed-stroke",
                  }}
                />
              )}
              {position && <NavigationUserMarker position={position} headingDeg={userHeading} />}
            </MapContainer>
          </Box>
        </>

      <AppBanner
        message={loadError || (startGate === "ready" ? offRouteBannerText : "")}
        type={loadError ? "error" : "warning"}
        durationMs={loadError ? 0 : 0}
        top="max(148px, calc(env(safe-area-inset-top) + 108px))"
        sx={{ zIndex: 3200 }}
      />
    </Box>
  );
}
