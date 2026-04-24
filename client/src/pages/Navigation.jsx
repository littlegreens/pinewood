import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  FormControlLabel,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import StopIcon from "@mui/icons-material/Stop";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { detectLanguage, t } from "../services/i18n.js";
import { apiFetch } from "../services/api.js";
import {
  playOffRouteBeep,
  speakOffRouteMessage,
  vibrateOffRoute,
  vibrateOffRoutePulse,
} from "../services/navigationAlerts.js";
import {
  exitDocumentFullscreen,
  isDocumentFullscreenActive,
  lockPortraitOrientation,
  requestDocumentFullscreen,
} from "../utils/screenChrome.js";
import AppDialogTitle from "../components/AppDialogTitle.jsx";

const POCKET_INTRO_SKIP_KEY = "pinewood_skip_pocket_intro";
const START_GATE_RADIUS_M = 300;
const GPS_START_TIMEOUT_MS = 14000;
const OFF_ROUTE_VIBRATE_PULSE_MS = 6000;
const OFF_ROUTE_VOICE_INTERVAL_MS = 12000;
const NAV_RUNTIME_STATE_KEY_PREFIX = "pinewood_nav_runtime_";
const OFF_ROUTE_ENTER_M = 50;
const OFF_ROUTE_EXIT_M = 35;
const OFF_ROUTE_ENTER_DELAY_MS = 4500;
const OFF_ROUTE_EXIT_DELAY_MS = 2500;
const VISIT_MARGIN_M = 8;

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

function NavigationUserMarker({ position, headingDeg }) {
  const icon = useMemo(() => {
    const hasHeading = typeof headingDeg === "number" && !Number.isNaN(headingDeg);
    const stroke = "#3a3a3a";
    const fill = "#e8c85c";
    const html = hasHeading
      ? `<div style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;transform:rotate(${headingDeg}deg);filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4))"><svg width="30" height="30" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="${fill}" stroke="${stroke}" stroke-width="1" stroke-linejoin="round" vector-effect="non-scaling-stroke" d="M12 3 L21 20 L12 15.5 L3 20 Z"/></svg></div>`
      : `<div style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.35))"><div style="width:18px;height:18px;border-radius:50%;background:${fill};border:1px solid ${stroke};box-sizing:border-box"></div></div>`;
    return L.divIcon({
      className: "pinewood-nav-user-icon",
      html,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });
  }, [headingDeg]);
  return <Marker position={position} icon={icon} />;
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
  const [completionPct, setCompletionPct] = useState(null);
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
  const pocketTouchStartY = useRef(null);
  const lockDragOffsetYRef = useRef(0);
  const [lockDragOffsetY, setLockDragOffsetY] = useState(0);
  const [lockDragging, setLockDragging] = useState(false);
  const wasOffRouteRef = useRef(false);
  const lastOffRoutePulseAtRef = useRef(0);
  const wakeLockRef = useRef(null);
  const pocketLayerRef = useRef(null);
  const [pocketIntroOpen, setPocketIntroOpen] = useState(false);
  const [pocketIntroSkipChecked, setPocketIntroSkipChecked] = useState(false);
  /** checking = verifica 300 m dal tracciato / GPS; ready = navigazione attiva */
  const [startGate, setStartGate] = useState("checking");
  const sessionAbortedRef = useRef(false);
  const gpsTimeoutRef = useRef(null);
  const [fullscreenActive, setFullscreenActive] = useState(false);
  const [chromeUnlocked, setChromeUnlocked] = useState(false);
  const runtimeHydratedRef = useRef(false);
  const unlockTouchStartYRef = useRef(null);
  const unlockDragOffsetYRef = useRef(0);
  const [unlockDragOffsetY, setUnlockDragOffsetY] = useState(0);
  const [unlockDragging, setUnlockDragging] = useState(false);
  const [visitedIntervals, setVisitedIntervals] = useState([]);
  const visitedIntervalsRef = useRef([]);
  const lastAlongRef = useRef(null);
  const pendingOffRouteSinceRef = useRef(null);
  const pendingOnRouteSinceRef = useRef(null);

  function navRuntimeStateKey() {
    return `${NAV_RUNTIME_STATE_KEY_PREFIX}${sessionId}`;
  }

  function mergeIntervals(intervals, incoming) {
    const valid = [...intervals, incoming]
      .filter((r) => Number.isFinite(r[0]) && Number.isFinite(r[1]) && r[1] >= r[0])
      .sort((a, b) => a[0] - b[0]);
    if (valid.length === 0) return [];
    const out = [valid[0]];
    for (let i = 1; i < valid.length; i += 1) {
      const cur = valid[i];
      const last = out[out.length - 1];
      if (cur[0] <= last[1] + 1) {
        last[1] = Math.max(last[1], cur[1]);
      } else {
        out.push([cur[0], cur[1]]);
      }
    }
    return out;
  }

  function coveredMeters(intervals) {
    return intervals.reduce((acc, r) => acc + Math.max(0, r[1] - r[0]), 0);
  }

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    if (location.state?.fromTrailDetail) {
      requestDocumentFullscreen();
      lockPortraitOrientation();
    }
  }, [location.state]);

  const abortStartSession = useCallback(async () => {
    if (sessionAbortedRef.current) return;
    sessionAbortedRef.current = true;
    try {
      await apiFetch(`/api/sessions/${sessionId}/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          completion_pct: null,
          deviations_count: 0,
          actual_geom: [],
        }),
      });
    } catch {
      /* ignore */
    }
  }, [sessionId]);

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
    return { distance: Math.sqrt(dx * dx + dy * dy), t };
  }

  /** Distanza ortogonale minima dal punto alla polyline (qualsiasi segmento). */
  function minDistanceToTrailMeters(point, trailLine) {
    if (trailLine.length === 0) return Number.POSITIVE_INFINITY;
    if (trailLine.length === 1) return distanceMeters(point, trailLine[0]);
    let minD = Number.POSITIVE_INFINITY;
    for (let i = 0; i < trailLine.length - 1; i += 1) {
      const { distance } = pointProjectionOnSegment(point, trailLine[i], trailLine[i + 1]);
      if (distance < minD) minD = distance;
    }
    return minD;
  }

  useEffect(() => {
    let watchId;
    prevPosRef.current = null;
    lastHeadingRef.current = null;
    setUserHeading(null);
    async function load() {
      const res = await apiFetch(`/api/sessions/${sessionId}`);
      if (res.status === 401) {
        navigate("/");
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      const coords = data?.geom_geojson?.coordinates || [];
      setLine(coords.map(([lon, lat]) => [lat, lon]));
      setElevationProfile(Array.isArray(data?.elevation_profile) ? data.elevation_profile : []);
      setParseStatus(data?.parse_status || null);
      setWaypoints(Array.isArray(data?.waypoints) ? data.waypoints : []);
      watchId = navigator.geolocation.watchPosition(
        (p) => {
          const lat = p.coords.latitude;
          const lon = p.coords.longitude;
          const pos = [lat, lon];
          let h = null;
          const speed = p.coords.speed;
          if (
            typeof p.coords.heading === "number" &&
            !Number.isNaN(p.coords.heading) &&
            (speed == null || speed > 0.35)
          ) {
            h = p.coords.heading;
          } else if (prevPosRef.current) {
            const moved = distanceMeters(prevPosRef.current, pos);
            if (moved > 4) {
              h = bearingDeg(prevPosRef.current, pos);
            }
          }
          if (h == null) {
            h = lastHeadingRef.current;
          } else {
            lastHeadingRef.current = h;
          }
          prevPosRef.current = pos;
          setPosition(pos);
          setUserHeading(h);
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );
    }
    load();
    return () => {
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
    };
  }, [sessionId, navigate]);

  const center = line[0] || [41.9, 12.5];
  const cumulativeDistances = useMemo(() => {
    if (line.length === 0) return [0];
    const out = [0];
    for (let i = 1; i < line.length; i += 1) {
      out.push(out[i - 1] + distanceMeters(line[i - 1], line[i]));
    }
    return out;
  }, [line]);

  useEffect(() => {
    if (startGate !== "ready") return;
    if (!position || line.length === 0) return;
    let minSegDist = Number.POSITIVE_INFINITY;
    let bestAlong = 0;
    for (let i = 0; i < line.length - 1; i += 1) {
      const segLen = Math.max(0, cumulativeDistances[i + 1] - cumulativeDistances[i]);
      const { distance, t } = pointProjectionOnSegment(position, line[i], line[i + 1]);
      const along = cumulativeDistances[i] + segLen * t;
      if (distance < minSegDist - 1 || (Math.abs(distance - minSegDist) <= 1 && along < bestAlong)) {
        minSegDist = distance;
        bestAlong = along;
      }
    }
    const totalDist = Math.max(1, cumulativeDistances[cumulativeDistances.length - 1]);
    let alongForCoverage = bestAlong;
    if (lastAlongRef.current != null && Math.abs(bestAlong - lastAlongRef.current) > 250) {
      alongForCoverage = lastAlongRef.current;
    }
    const prevAlong = lastAlongRef.current ?? alongForCoverage;
    const from = Math.max(0, Math.min(prevAlong, alongForCoverage) - VISIT_MARGIN_M);
    const to = Math.min(totalDist, Math.max(prevAlong, alongForCoverage) + VISIT_MARGIN_M);
    const merged = mergeIntervals(visitedIntervalsRef.current, [from, to]);
    visitedIntervalsRef.current = merged;
    setVisitedIntervals(merged);
    const covered = coveredMeters(merged);
    const pct = Math.round((covered / totalDist) * 100);
    setCompletionPct(Math.max(0, Math.min(100, pct)));
    lastAlongRef.current = alongForCoverage;
    setUserDistanceM(bestAlong);
    const now = Date.now();
    const currentlyOff = wasOffRouteRef.current;
    if (!currentlyOff && minSegDist > OFF_ROUTE_ENTER_M) {
      if (!pendingOffRouteSinceRef.current) pendingOffRouteSinceRef.current = now;
      if (now - pendingOffRouteSinceRef.current >= OFF_ROUTE_ENTER_DELAY_MS) {
        wasOffRouteRef.current = true;
        pendingOffRouteSinceRef.current = null;
        pendingOnRouteSinceRef.current = null;
        setIsOffRoute(true);
        lastOffRoutePulseAtRef.current = now;
        setDeviationsCount((v) => v + 1);
        playOffRouteBeep();
        speakOffRouteMessage(t(lang, "navOffRouteVoice"), lang);
        vibrateOffRoute();
      }
    } else if (currentlyOff && minSegDist < OFF_ROUTE_EXIT_M) {
      if (!pendingOnRouteSinceRef.current) pendingOnRouteSinceRef.current = now;
      if (now - pendingOnRouteSinceRef.current >= OFF_ROUTE_EXIT_DELAY_MS) {
        wasOffRouteRef.current = false;
        pendingOnRouteSinceRef.current = null;
        pendingOffRouteSinceRef.current = null;
        lastOffRoutePulseAtRef.current = 0;
        setIsOffRoute(false);
      }
    } else if (currentlyOff) {
      pendingOnRouteSinceRef.current = null;
      if (now - lastOffRoutePulseAtRef.current >= OFF_ROUTE_VIBRATE_PULSE_MS) {
        lastOffRoutePulseAtRef.current = now;
        vibrateOffRoutePulse();
      }
      setIsOffRoute(true);
    } else {
      pendingOffRouteSinceRef.current = null;
      setIsOffRoute(false);
    }
  }, [position, line, cumulativeDistances, actualTrack.length, lang, startGate]);

  useEffect(() => {
    setStartGate("checking");
    sessionAbortedRef.current = false;
    setPocketMode(false);
    setActualTrack([]);
    setCompletionPct(null);
    setDeviationsCount(0);
    setIsOffRoute(false);
    wasOffRouteRef.current = false;
    visitedIntervalsRef.current = [];
    setVisitedIntervals([]);
    lastAlongRef.current = null;
    pendingOffRouteSinceRef.current = null;
    pendingOnRouteSinceRef.current = null;
    setUserDistanceM(null);
  }, [sessionId]);

  useEffect(() => {
    if (startGate !== "checking") {
      if (gpsTimeoutRef.current != null) {
        clearTimeout(gpsTimeoutRef.current);
        gpsTimeoutRef.current = null;
      }
      return;
    }
    gpsTimeoutRef.current = window.setTimeout(() => {
      gpsTimeoutRef.current = null;
      setStartGate((prev) => {
        if (prev !== "checking") return prev;
        void abortStartSession();
        return "blocked_gps";
      });
    }, GPS_START_TIMEOUT_MS);
    return () => {
      if (gpsTimeoutRef.current != null) {
        clearTimeout(gpsTimeoutRef.current);
        gpsTimeoutRef.current = null;
      }
    };
  }, [startGate, sessionId, abortStartSession]);

  useEffect(() => {
    if (startGate !== "checking") return;
    if (!line.length || !position) return;
    if (gpsTimeoutRef.current != null) {
      clearTimeout(gpsTimeoutRef.current);
      gpsTimeoutRef.current = null;
    }
    const d = minDistanceToTrailMeters(position, line);
    if (d > START_GATE_RADIUS_M) {
      void abortStartSession().then(() => setStartGate("blocked_too_far"));
    } else {
      setStartGate("ready");
    }
  }, [line, position, startGate, abortStartSession]);

  useEffect(() => {
    if (!isOffRoute) return;
    if (startGate !== "ready") return;
    const id = window.setInterval(() => {
      speakOffRouteMessage(t(lang, "navOffRouteVoice"), lang);
    }, OFF_ROUTE_VOICE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isOffRoute, lang, startGate]);

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
    if (startGate !== "ready" || pocketMode || chromeUnlocked) return;
    requestDocumentFullscreen();
    lockPortraitOrientation();
  }, [startGate, pocketMode, chromeUnlocked]);

  useEffect(() => {
    if (startGate !== "ready" || pocketMode) return;
    requestDocumentFullscreen();
    lockPortraitOrientation();
  }, [startGate, pocketMode]);

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
      if (typeof parsed.completionPct === "number") setCompletionPct(parsed.completionPct);
      if (typeof parsed.deviationsCount === "number") setDeviationsCount(parsed.deviationsCount);
      if (typeof parsed.isOffRoute === "boolean") {
        setIsOffRoute(parsed.isOffRoute);
        wasOffRouteRef.current = parsed.isOffRoute;
      }
      if (typeof parsed.userDistanceM === "number") setUserDistanceM(parsed.userDistanceM);
      if (typeof parsed.userHeading === "number") {
        setUserHeading(parsed.userHeading);
        lastHeadingRef.current = parsed.userHeading;
      }
      if (typeof parsed.startGate === "string" && parsed.startGate !== "checking") {
        setStartGate(parsed.startGate);
      }
      if (typeof parsed.pocketMode === "boolean") setPocketMode(parsed.pocketMode);
      if (typeof parsed.chromeUnlocked === "boolean") setChromeUnlocked(parsed.chromeUnlocked);
      if (Array.isArray(parsed.visitedIntervals)) {
        visitedIntervalsRef.current = parsed.visitedIntervals;
        setVisitedIntervals(parsed.visitedIntervals);
      }
    } catch {
      /* ignore corrupted runtime snapshot */
    } finally {
      runtimeHydratedRef.current = true;
    }
  }, [sessionId]);

  useEffect(() => {
    if (!runtimeHydratedRef.current) return;
    const snapshot = {
      completionPct,
      deviationsCount,
      actualTrack,
      isOffRoute,
      userDistanceM,
      userHeading,
      startGate,
      pocketMode,
      chromeUnlocked,
      visitedIntervals,
      updatedAt: Date.now(),
    };
    try {
      sessionStorage.setItem(navRuntimeStateKey(), JSON.stringify(snapshot));
    } catch {
      /* ignore quota/storage issues */
    }
  }, [
    sessionId,
    completionPct,
    deviationsCount,
    actualTrack,
    isOffRoute,
    userDistanceM,
    userHeading,
    startGate,
    pocketMode,
    chromeUnlocked,
    visitedIntervals,
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

  useEffect(() => {
    if (!mapInstance || line.length === 0) return;
    mapInstance.setView(line[0], Math.max(mapInstance.getZoom(), 17), { animate: true });
  }, [mapInstance, line]);

  useEffect(() => {
    if (startGate !== "ready") return;
    if (!position) return;
    setActualTrack((prev) => {
      if (prev.length === 0) return [position];
      const last = prev[prev.length - 1];
      if (distanceMeters(last, position) < 8) return prev;
      return [...prev, position];
    });
  }, [position, startGate]);

  useEffect(() => {
    if (startGate !== "ready") {
      setChromeUnlocked(false);
    }
  }, [startGate, sessionId]);

  useEffect(() => {
    if (startGate !== "ready") return;
    const interval = setInterval(async () => {
      await apiFetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          completion_pct: completionPct,
          deviations_count: deviationsCount,
          actual_geom: actualTrack,
        }),
      });
    }, 10000);
    return () => clearInterval(interval);
  }, [sessionId, completionPct, deviationsCount, actualTrack, startGate]);

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

  function handleForcedBackFromStartGate() {
    const target = buildExitNavigationTarget();
    navigate(target.pathname, { replace: true, state: target.state });
  }

  async function finishSession() {
    await apiFetch(`/api/sessions/${sessionId}/finish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        completion_pct: completionPct,
        deviations_count: deviationsCount,
        actual_geom: actualTrack,
      }),
    });
    sessionStorage.removeItem(navRuntimeStateKey());
    const target = buildExitNavigationTarget();
    navigate(target.pathname, { replace: true, state: target.state });
  }

  function centerOnUser() {
    if (!mapInstance || !position) return;
    mapInstance.setView(position, Math.max(mapInstance.getZoom(), 15), { animate: true });
  }

  function buildElevationPath(profile, width, height, pad) {
    const minD = profile[0].distance_m;
    const maxD = profile[profile.length - 1].distance_m || minD + 1;
    const elevs = profile.map((p) => p.elevation_m);
    const minE = Math.min(...elevs);
    const maxE = Math.max(...elevs);
    const spanD = Math.max(1, maxD - minD);
    const spanE = Math.max(1, maxE - minE);
    const points = profile.map((p) => {
      const x = pad + ((p.distance_m - minD) / spanD) * (width - pad * 2);
      const y = height - pad - ((p.elevation_m - minE) / spanE) * (height - pad * 2);
      return { x, y };
    });
    const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    const userX =
      userDistanceM == null
        ? null
        : pad + ((Math.min(maxD, Math.max(minD, userDistanceM)) - minD) / spanD) * (width - pad * 2);
    const waypointDots = (waypoints || [])
      .filter((wp) => Number.isFinite(wp.distance_from_start_m))
      .map((wp) => ({
        x: pad + ((wp.distance_from_start_m - minD) / spanD) * (width - pad * 2),
      }));
    return { d, minE: Math.round(minE), maxE: Math.round(maxE), userX, waypointDots };
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
    if (startGate !== "ready") return;
    if (localStorage.getItem(POCKET_INTRO_SKIP_KEY) === "1") {
      setPocketMode(true);
      requestDocumentFullscreen();
      return;
    }
    setPocketIntroSkipChecked(false);
    setPocketIntroOpen(true);
  }

  function confirmPocketIntro() {
    if (pocketIntroSkipChecked) {
      localStorage.setItem(POCKET_INTRO_SKIP_KEY, "1");
    }
    setPocketIntroOpen(false);
    setPocketMode(true);
    requestDocumentFullscreen();
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
        bgcolor: pocketMode ? "#000" : "background.default",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        overscrollBehaviorX: "none",
        touchAction: pocketMode ? "none" : "manipulation",
      }}
    >
      {!pocketMode ? (
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
          </Box>

          <Box sx={{ width: "100%", flex: 1, position: "relative", minHeight: 0 }}>
            {startGate === "ready" && (
            <Box
              sx={{
                position: "absolute",
                top: "max(10px, env(safe-area-inset-top))",
                left: 10,
                right: 10,
                zIndex: 1200,
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 1,
                pointerEvents: "none",
              }}
            >
              <Chip
                label={`${t(lang, "navProgress")}: ${completionPct ?? "--"}${completionPct != null ? "%" : ""}`}
                sx={{
                  pointerEvents: "auto",
                  bgcolor: "rgba(255,255,255,0.94)",
                  color: "#111",
                  fontWeight: 700,
                  fontSize: "0.74rem",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
                }}
              />
              <IconButton
                onClick={centerOnUser}
                sx={{
                  pointerEvents: "auto",
                  bgcolor: "rgba(255,255,255,0.94)",
                  color: "#111",
                  p: 0.55,
                  border: "1px solid rgba(0,0,0,0.08)",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
                  "&:hover": { bgcolor: "#fff" },
                }}
                aria-label="Centra su di me"
              >
                <MyLocationIcon fontSize="small" />
              </IconButton>
            </Box>
            )}

            {startGate === "ready" && isOffRoute && (
              <Box
                className="nav-off-toast"
                sx={{
                  position: "fixed",
                  left: 14,
                  right: 14,
                  bottom: "calc(max(10px, env(safe-area-inset-bottom)) + 72px)",
                  zIndex: 1450,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 0.8,
                  px: 1.6,
                  py: 0.85,
                  borderRadius: 1.5,
                  backgroundColor: "#fff3cd",
                  color: "#5c4300",
                  boxShadow: "0 4px 14px rgba(0,0,0,0.16)",
                  border: "1px solid #f1d58a",
                  pointerEvents: "none",
                }}
              >
                <WarningAmberRoundedIcon sx={{ fontSize: 21, color: "#b36b00", flexShrink: 0 }} />
                <Typography sx={{ fontWeight: 700, fontSize: "0.88rem", lineHeight: 1.25 }}>
                  {t(lang, "navOffRouteAlertShort")}
                </Typography>
              </Box>
            )}

            {startGate === "ready" && (
            <Box
              sx={{
                position: "fixed",
                left: 0,
                right: 0,
                bottom: "max(10px, env(safe-area-inset-bottom))",
                zIndex: 1400,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                pl: "max(14px, env(safe-area-inset-left))",
                pr: "max(14px, env(safe-area-inset-right))",
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
              <IconButton
                onTouchStart={onUnlockTouchStart}
                onTouchMove={onUnlockTouchMove}
                onTouchEnd={onUnlockTouchEnd}
                aria-label={t(lang, "lockModeActive")}
                sx={{
                  pointerEvents: "auto",
                  width: 58,
                  height: 58,
                  borderRadius: "50%",
                  bgcolor: "#111",
                  color: "#fff",
                  border: "none",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.28)",
                  transform: `translateY(${unlockDragOffsetY}px)`,
                  transition: unlockDragging ? "none" : "transform 180ms ease-out",
                  "&:hover": { bgcolor: "#222" },
                }}
              >
                <LockOutlinedIcon sx={{ fontSize: 28, color: "#fff" }} />
              </IconButton>
              <IconButton
                onClick={requestPocketMode}
                aria-label={t(lang, "pocketMode")}
                sx={{
                  pointerEvents: "auto",
                  width: 58,
                  height: 58,
                  borderRadius: "50%",
                  bgcolor: "#111",
                  color: "#fff",
                  border: "none",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.28)",
                  "&:hover": { bgcolor: "#222" },
                }}
              >
                <img
                  src="/mobile_block.svg"
                  alt={t(lang, "pocketMode")}
                  style={{ width: 28, height: 28, filter: "invert(1) brightness(1.15)" }}
                />
              </IconButton>
            </Box>
            )}

            <MapContainer
              center={center}
              zoom={14}
              style={{ width: "100%", height: "100%" }}
              zoomControl={false}
            >
              <MapReadyBridge onReady={setMapInstance} />
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="" />
              {line.length > 1 && <Polyline positions={line} pathOptions={{ color: "#2D4F1E", weight: 4 }} />}
              {actualTrack.length > 1 && (
                <Polyline positions={actualTrack} pathOptions={{ color: "#c9a84c", weight: 3, opacity: 0.9 }} />
              )}
              {position && <NavigationUserMarker position={position} headingDeg={userHeading} />}
            </MapContainer>
          </Box>
        </>
      ) : (
        <Stack
          ref={pocketLayerRef}
          sx={{
            position: "fixed",
            inset: 0,
            zIndex: 2100,
            minHeight: "100dvh",
            maxHeight: "100dvh",
            alignItems: "center",
            justifyContent: "space-between",
            color: "#fff",
            pt: "max(6vh, env(safe-area-inset-top))",
            pb: "max(6vh, calc(env(safe-area-inset-bottom) + 16px))",
            px: 0,
            overscrollBehavior: "none",
            touchAction: "none",
            width: "100%",
            bgcolor: "#000",
            WebkitTouchCallout: "none",
            userSelect: "none",
          }}
        >
          <img
            src="/logo.svg"
            alt="Pinewood"
            style={{ width: 250, opacity: 1, filter: "brightness(0) invert(1)" }}
          />
          <Box sx={{ display: "grid", placeItems: "center", mb: "5vh" }}>
            <Box
              onTouchStart={onLockTouchStart}
              onTouchMove={onLockTouchMove}
              onTouchEnd={onLockTouchEnd}
              sx={{
                width: 74,
                height: 74,
                borderRadius: "50%",
                border: isOffRoute ? "2px solid #3d0a0a" : "2px solid rgba(255,255,255,0.92)",
                bgcolor: isOffRoute ? "rgba(55, 12, 12, 0.95)" : "transparent",
                display: "grid",
                placeItems: "center",
                transform: `translateY(${lockDragOffsetY - 8}px)`,
                transition: lockDragging ? "none" : "transform 180ms ease-out, background-color 0.25s, border-color 0.25s",
                touchAction: "none",
              }}
            >
              <LockOutlinedIcon sx={{ fontSize: 38, opacity: 0.95, color: isOffRoute ? "#ff8a80" : "#fff" }} />
            </Box>
            <Typography sx={{ mt: 1.1, fontSize: "0.8rem", opacity: 0.9, fontWeight: 400 }}>
              {t(lang, "unlockBySwipe")}
            </Typography>
          </Box>
        </Stack>
      )}

      <Dialog
        open={startGate === "blocked_too_far" || startGate === "blocked_gps"}
        disableEscapeKeyDown
        onClose={() => {}}
        maxWidth="xs"
        fullWidth
        slotProps={{
          backdrop: { sx: { backgroundColor: "rgba(0,0,0,0.78)" } },
        }}
      >
        {startGate === "blocked_gps" && (
          <AppDialogTitle title={t(lang, "navStartBlockedTitle")} />
        )}
        <DialogContent sx={startGate === "blocked_too_far" ? { pt: 3 } : undefined}>
          <Typography sx={{ color: "text.secondary", lineHeight: 1.55 }}>
            {startGate === "blocked_gps" ? t(lang, "navStartNoGps") : t(lang, "navStartTooFar")}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2, pt: 0 }}>
          <Button variant="contained" color="primary" fullWidth onClick={handleForcedBackFromStartGate}>
            {t(lang, "navStartGoBack")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={pocketIntroOpen} onClose={cancelPocketIntro} fullWidth maxWidth="sm">
        <AppDialogTitle title={t(lang, "pocketIntroTitle")} />
        <DialogContent>
          <Typography sx={{ color: "text.secondary", lineHeight: 1.55, whiteSpace: "pre-line" }}>
            {t(lang, "pocketIntroBody")}
          </Typography>
          <FormControlLabel
            sx={{ mt: 2, alignItems: "flex-start" }}
            control={
              <Checkbox
                checked={pocketIntroSkipChecked}
                onChange={(e) => setPocketIntroSkipChecked(e.target.checked)}
                color="primary"
              />
            }
            label={t(lang, "pocketIntroDontShowAgain")}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={cancelPocketIntro} color="inherit">
            {t(lang, "cancel")}
          </Button>
          <Button onClick={confirmPocketIntro} variant="contained" color="primary">
            {t(lang, "pocketIntroConfirm")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
