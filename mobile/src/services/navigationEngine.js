import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import * as TaskManager from "expo-task-manager";
import { apiFetch } from "./api";
import { distanceMeters, bearingDeg } from "../utils/geo";
import { t } from "./i18n";

export const NAV_BG_TASK_NAME = "pinewood-nav-background-location";

const OFF_ROUTE_ENTER_M = 32;
const OFF_ROUTE_EXIT_M = 24;
const OFF_ROUTE_ENTER_DELAY_MS = 5000;
const OFF_ROUTE_EXIT_DELAY_MS = 3000;
const OFF_ROUTE_VOICE_INTERVAL_MS = 3000;
const OFF_ROUTE_VIBRATE_PULSE_MS = 900;
/** Fix GPS peggiori di così: non cambiare stato (evita falsi allarmi), ma ripeti avvisi se già fuori. */
const GPS_MAX_ACCURACY_TRUST_M = 55;
const OFF_ROUTE_ENTER_MIN_SAMPLES = 2;
const HEADING_PUBLISH_MIN_DELTA_DEG = 2;
const MIN_TRACK_POINT_DIST_M = 8;
const SESSION_PATCH_INTERVAL_MS = 10000;

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

function toLocalXY(point, originLat) {
  const latF = 111320;
  const lonF = 111320 * Math.cos((originLat * Math.PI) / 180);
  return { x: point[1] * lonF, y: point[0] * latF };
}

function pointToSegmentProjection(point, segA, segB) {
  const originLat = (segA[0] + segB[0]) / 2;
  const p = toLocalXY(point, originLat);
  const a = toLocalXY(segA, originLat);
  const b = toLocalXY(segB, originLat);
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = p.x - a.x;
  const apy = p.y - a.y;
  const lenSq = abx * abx + aby * aby;
  const tt = lenSq > 0 ? Math.max(0, Math.min(1, (apx * abx + apy * aby) / lenSq)) : 0;
  const cx = a.x + tt * abx;
  const cy = a.y + tt * aby;
  const dx = p.x - cx;
  const dy = p.y - cy;
  return { distance: Math.sqrt(dx * dx + dy * dy), t: tt };
}

export function computeCumulativeDistances(trailLine) {
  if (trailLine.length === 0) return [0];
  const out = [0];
  for (let i = 1; i < trailLine.length; i++) {
    out.push(out[i - 1] + distanceMeters(trailLine[i - 1], trailLine[i]));
  }
  return out;
}

function computeUserProjectionAlongTrail(userPos, trailLine, cumDist) {
  if (trailLine.length < 2) {
    return {
      minDist: trailLine.length === 1 ? distanceMeters(userPos, trailLine[0]) : Infinity,
      along: 0,
      nearestPoint: trailLine[0] || null,
    };
  }
  let minSegDist = Infinity;
  let bestAlong = 0;
  let nearestPoint = trailLine[0];
  for (let i = 0; i < trailLine.length - 1; i++) {
    const segLen = Math.max(0, cumDist[i + 1] - cumDist[i]);
    const { distance, t: segT } = pointToSegmentProjection(userPos, trailLine[i], trailLine[i + 1]);
    const along = cumDist[i] + segLen * segT;
    if (distance < minSegDist - 1 || (Math.abs(distance - minSegDist) <= 1 && along < bestAlong)) {
      minSegDist = distance;
      bestAlong = along;
      nearestPoint = [
        trailLine[i][0] + (trailLine[i + 1][0] - trailLine[i][0]) * segT,
        trailLine[i][1] + (trailLine[i + 1][1] - trailLine[i][1]) * segT,
      ];
    }
  }
  return { minDist: minSegDist, along: bestAlong, nearestPoint };
}

function speakOffRoute(lang) {
  const voiceLang = lang === "it" ? "it-IT" : "en-US";
  Speech.speak(t(lang, "navOffRouteVoice"), { language: voiceLang, rate: 1 });
}

function repeatOffRouteAlerts(now) {
  if (now - runtime.lastOffRoutePulse >= OFF_ROUTE_VIBRATE_PULSE_MS) {
    runtime.lastOffRoutePulse = now;
    pulseOffRouteHaptics();
  }
  if (now - runtime.lastOffRouteVoice >= OFF_ROUTE_VOICE_INTERVAL_MS) {
    runtime.lastOffRouteVoice = now;
    speakOffRoute(runtime.lang);
  }
  runtime.listeners.onOffRouteChange?.(true, runtime.deviationsCount);
}

/** Sequenza di impatti forti (ripetuta mentre sei fuori traccia). */
function pulseOffRouteHaptics() {
  (async () => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      await new Promise((r) => setTimeout(r, 70));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await new Promise((r) => setTimeout(r, 90));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await new Promise((r) => setTimeout(r, 90));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
      await new Promise((r) => setTimeout(r, 120));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {
      /* ignore */
    }
  })();
}

const runtime = {
  active: false,
  lang: "it",
  sessionId: null,
  trailLine: [],
  cumulativeDistances: [0],
  totalTrailM: 1,
  prevPos: null,
  lastHeading: null,
  publishedHeading: null,
  wasOffRoute: false,
  pendingOffRouteSince: null,
  pendingOnRouteSince: null,
  lastOffRoutePulse: 0,
  lastOffRouteVoice: 0,
  offRouteEnterSamples: 0,
  lastPatch: 0,
  actualTrack: [],
  deviationsCount: 0,
  listeners: {},
};

export function configureNavigation({
  lang,
  sessionId,
  trailLine,
  cumulativeDistances,
  totalTrailM,
}) {
  runtime.active = true;
  runtime.lang = lang || "it";
  runtime.sessionId = sessionId;
  runtime.trailLine = trailLine || [];
  runtime.cumulativeDistances = cumulativeDistances || [0];
  runtime.totalTrailM = totalTrailM > 0 ? totalTrailM : 1;
  runtime.wasOffRoute = false;
  runtime.pendingOffRouteSince = null;
  runtime.pendingOnRouteSince = null;
  runtime.lastOffRoutePulse = 0;
  runtime.lastOffRouteVoice = 0;
  runtime.offRouteEnterSamples = 0;
  runtime.actualTrack = [];
  runtime.deviationsCount = 0;
}

export function setNavigationListeners(listeners) {
  runtime.listeners = listeners || {};
}

export function clearNavigation() {
  runtime.active = false;
  runtime.trailLine = [];
  runtime.listeners = {};
}

/** Soglia velocità (m/s): sotto ~1.5 km/h usa bussola; sopra usa GPS bearing. */
const COMPASS_MAX_SPEED_MS = 1.5 / 3.6;

/**
 * @param {[number, number]} pos
 * @param {number|null} deviceHeading heading GPS (coords.heading)
 * @param {number|null} speed m/s
 * @param {number|null} accuracy m
 * @param {number|null} compassHeading bussola magnetica / trueHeading
 */
export function processNavigationPosition(
  pos,
  deviceHeading,
  speed,
  accuracy = null,
  compassHeading = null,
) {
  if (!runtime.active || !Array.isArray(pos)) return;
  const gpsTrustworthy =
    accuracy == null || !Number.isFinite(accuracy) || accuracy <= GPS_MAX_ACCURACY_TRUST_M;

  const movingFast =
    typeof speed === "number" && !Number.isNaN(speed) && speed >= COMPASS_MAX_SPEED_MS;

  let h = null;
  if (movingFast) {
    if (typeof deviceHeading === "number" && !Number.isNaN(deviceHeading) && deviceHeading >= 0) {
      h = deviceHeading;
    } else if (runtime.prevPos) {
      const moved = distanceMeters(runtime.prevPos, pos);
      if (moved > 4) h = bearingDeg(runtime.prevPos, pos);
    }
  } else if (typeof compassHeading === "number" && !Number.isNaN(compassHeading)) {
    h = compassHeading;
  } else if (
    typeof deviceHeading === "number" &&
    !Number.isNaN(deviceHeading) &&
    deviceHeading >= 0 &&
    (speed == null || speed > 0.35)
  ) {
    h = deviceHeading;
  } else if (runtime.prevPos) {
    const moved = distanceMeters(runtime.prevPos, pos);
    if (moved > 4) h = bearingDeg(runtime.prevPos, pos);
  }
  if (h == null) {
    h = runtime.lastHeading;
  } else {
    h = smoothHeadingDeg(runtime.lastHeading, h);
    runtime.lastHeading = h;
  }
  runtime.prevPos = pos;

  const pub = runtime.publishedHeading;
  if (typeof h === "number" && !Number.isNaN(h)) {
    if (pub == null || Math.abs(shortestAngleDeltaDeg(pub, h)) >= HEADING_PUBLISH_MIN_DELTA_DEG) {
      runtime.publishedHeading = h;
      runtime.listeners.onHeading?.(h);
    }
  }
  runtime.listeners.onUserPos?.(pos);

  const line = runtime.trailLine
    .filter((c) => Number.isFinite(c.latitude) && Number.isFinite(c.longitude))
    .map((c) => [c.latitude, c.longitude]);
  if (line.length < 2) return;

  const { minDist, along, nearestPoint } = computeUserProjectionAlongTrail(
    pos,
    line,
    runtime.cumulativeDistances,
  );
  runtime.listeners.onAlongTrail?.(along, minDist, nearestPoint);

  const now = Date.now();
  const currentlyOff = runtime.wasOffRoute;

  if (!gpsTrustworthy) {
    if (currentlyOff) repeatOffRouteAlerts(now);
  } else if (!currentlyOff && minDist > OFF_ROUTE_ENTER_M) {
    runtime.offRouteEnterSamples += 1;
    if (!runtime.pendingOffRouteSince) runtime.pendingOffRouteSince = now;
    if (
      runtime.offRouteEnterSamples >= OFF_ROUTE_ENTER_MIN_SAMPLES &&
      now - runtime.pendingOffRouteSince >= OFF_ROUTE_ENTER_DELAY_MS
    ) {
      runtime.wasOffRoute = true;
      runtime.pendingOffRouteSince = null;
      runtime.pendingOnRouteSince = null;
      runtime.offRouteEnterSamples = 0;
      runtime.lastOffRoutePulse = now;
      runtime.lastOffRouteVoice = now;
      runtime.deviationsCount += 1;
      runtime.listeners.onOffRouteChange?.(true, runtime.deviationsCount);
      pulseOffRouteHaptics();
      speakOffRoute(runtime.lang);
    }
  } else if (gpsTrustworthy && currentlyOff && minDist < OFF_ROUTE_EXIT_M) {
    runtime.offRouteEnterSamples = 0;
    if (!runtime.pendingOnRouteSince) runtime.pendingOnRouteSince = now;
    if (now - runtime.pendingOnRouteSince >= OFF_ROUTE_EXIT_DELAY_MS) {
      runtime.wasOffRoute = false;
      runtime.pendingOnRouteSince = null;
      runtime.pendingOffRouteSince = null;
      runtime.lastOffRoutePulse = 0;
      runtime.lastOffRouteVoice = 0;
      runtime.listeners.onOffRouteChange?.(false, runtime.deviationsCount);
    }
  } else if (currentlyOff) {
    runtime.offRouteEnterSamples = 0;
    runtime.pendingOnRouteSince = null;
    repeatOffRouteAlerts(now);
  } else if (gpsTrustworthy) {
    runtime.offRouteEnterSamples = 0;
    runtime.pendingOffRouteSince = null;
    runtime.listeners.onOffRouteChange?.(false, runtime.deviationsCount);
  }

  let track = runtime.actualTrack;
  if (track.length === 0) {
    track = [pos];
  } else {
    const last = track[track.length - 1];
    if (distanceMeters(last, pos) >= MIN_TRACK_POINT_DIST_M) {
      track = [...track, pos];
    }
  }
  runtime.actualTrack = track;
  runtime.listeners.onTrack?.(track);

  if (runtime.sessionId && now - runtime.lastPatch >= SESSION_PATCH_INTERVAL_MS) {
    runtime.lastPatch = now;
    apiFetch(`/api/sessions/${runtime.sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        current_lat: pos[0],
        current_lon: pos[1],
        progress: runtime.totalTrailM > 0 ? along / runtime.totalTrailM : 0,
        deviations_count: runtime.deviationsCount,
        actual_geom: track,
      }),
    }).catch(() => {});
  }
}

export function getNavigationRuntimeSnapshot() {
  return {
    actualTrack: runtime.actualTrack,
    deviationsCount: runtime.deviationsCount,
  };
}

if (!TaskManager.isTaskDefined(NAV_BG_TASK_NAME)) {
  TaskManager.defineTask(NAV_BG_TASK_NAME, ({ data, error }) => {
    if (error) return;
    if (!data?.locations?.length) return;
    const loc = data.locations[data.locations.length - 1];
    processNavigationPosition(
      [loc.coords.latitude, loc.coords.longitude],
      loc.coords.heading,
      loc.coords.speed,
      loc.coords.accuracy,
      null,
    );
  });
}
