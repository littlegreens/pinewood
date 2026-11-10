import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-csp-worker.js?url";
import "maplibre-gl/dist/maplibre-gl.css";

try {
  maplibregl.setWorkerUrl(maplibreWorkerUrl);
} catch (err) {
  console.warn("[NavigationMap] setWorkerUrl failed", err);
}

const OSM_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: [
        "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "� OpenStreetMap",
      maxzoom: 19,
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

const USER_MARKER_HTML = `<div class="pinewood-nav-user-rot" style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;will-change:transform;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4))"><svg width="30" height="30" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#e8c85c" stroke="#3a3a3a" stroke-width="1" stroke-linejoin="round" d="M12 3 L21 20 L12 15.5 L3 20 Z"/></svg></div>`;

const FOLLOW_RESUME_MS = 1400;
/** Smoothing bearing nativo (niente CSS sulla mappa): tau più lungo = meno jitter. */
const COMPASS_BEARING_TAU_MS = 300;
const MARKER_HEADING_TAU_MS = 70;
/** Non chiamare setBearing per micro-delta (rumore sensore). */
const COMPASS_BEARING_DEADBAND_DEG = 0.65;
/** Cap velocità angolare (°/s) verso il target. */
const COMPASS_MAX_BEARING_RATE_DEG_S = 110;
const POS_FOLLOW = 0.18;
const COMPASS_RECENTER_MIN_M = 6;
const COMPASS_RECENTER_MIN_MS = 450;

function toLngLat(latLng) {
  if (!latLng || latLng.length < 2) return null;
  const lat = Number(latLng[0]);
  const lng = Number(latLng[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return [lng, lat];
}

function normalizeAngleDeg(v) {
  return ((v % 360) + 360) % 360;
}

function shortestAngleDeltaDeg(from, to) {
  let d = normalizeAngleDeg(to) - normalizeAngleDeg(from);
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

function lerpAngleDeg(from, to, t) {
  return normalizeAngleDeg(from + shortestAngleDeltaDeg(from, to) * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function expSmoothAlpha(dtMs, tauMs) {
  if (tauMs <= 0) return 1;
  return 1 - Math.exp(-Math.max(0, dtMs) / tauMs);
}

function approxDistanceMeters(lng1, lat1, lng2, lat2) {
  const midLat = ((lat1 + lat2) / 2) * (Math.PI / 180);
  const dy = (lat2 - lat1) * 111_320;
  const dx = (lng2 - lng1) * 111_320 * Math.cos(midLat);
  return Math.hypot(dx, dy);
}

function lineToFeature(coordsLatLng) {
  const coordinates = (coordsLatLng || []).map((p) => toLngLat(p)).filter(Boolean);
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates },
  };
}

function emptyLineCollection() {
  return { type: "FeatureCollection", features: [] };
}

function setLineSource(map, id, coordsLatLng) {
  const src = map.getSource(id);
  if (!src) return;
  const data =
    coordsLatLng && coordsLatLng.length > 1
      ? { type: "FeatureCollection", features: [lineToFeature(coordsLatLng)] }
      : emptyLineCollection();
  src.setData(data);
}

/**
 * Navigazione MapLibre � solo API native (setBearing/setCenter).
 * CSS solo sulla freccia in nord-up (gia' collaudato).
 */
export default function NavigationMap({
  line = [],
  offRouteLine = null,
  position = null,
  headingDeg = null,
  headingLiveRef = null,
  compassOn = false,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const markerRotRef = useRef(null);
  const markerOnMapRef = useRef(false);
  const compassOnRef = useRef(compassOn);
  const headingRef = useRef(headingDeg);
  const headingLiveRefProp = useRef(headingLiveRef);
  const positionRef = useRef(position);
  const fittedTrailKeyRef = useRef("");
  const followPausedUntilRef = useRef(0);
  const userZoomingRef = useRef(false);
  const displayRef = useRef({
    lng: null,
    lat: null,
    heading: null,
    markerHeading: null,
  });
  const lastFrameTsRef = useRef(0);
  const lastRecenterAtRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState("");

  compassOnRef.current = compassOn;
  headingRef.current = headingDeg;
  headingLiveRefProp.current = headingLiveRef;
  positionRef.current = position;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return undefined;

    let map;
    let ro;
    let resizeTimers = [];
    let cancelled = false;
    let interactTimer = null;

    const pauseFollow = (ms = FOLLOW_RESUME_MS) => {
      followPausedUntilRef.current = Date.now() + ms;
    };

    const onInteractStart = () => {
      userZoomingRef.current = true;
      pauseFollow(FOLLOW_RESUME_MS);
      if (interactTimer) clearTimeout(interactTimer);
    };
    const onInteractEnd = () => {
      userZoomingRef.current = false;
      pauseFollow(FOLLOW_RESUME_MS);
      if (interactTimer) clearTimeout(interactTimer);
      interactTimer = setTimeout(() => {
        userZoomingRef.current = false;
      }, FOLLOW_RESUME_MS);
    };

    try {
      map = new maplibregl.Map({
        container: el,
        style: OSM_STYLE,
        center: toLngLat(position) || [12.5, 41.9],
        zoom: 15,
        attributionControl: false,
        pitchWithRotate: false,
        dragRotate: true,
        touchPitch: false,
        bearing: 0,
        maxPitch: 0,
        failIfMajorPerformanceCaveat: false,
        fadeDuration: 0,
      });
      mapRef.current = map;

      try {
        map.touchZoomRotate.enableRotation();
      } catch {
        /* ignore */
      }

      const markerEl = document.createElement("div");
      markerEl.innerHTML = USER_MARKER_HTML;
      markerEl.style.width = "40px";
      markerEl.style.height = "40px";
      markerRotRef.current = markerEl.querySelector(".pinewood-nav-user-rot");
      markerRef.current = new maplibregl.Marker({
        element: markerEl,
        anchor: "center",
        pitchAlignment: "viewport",
        rotationAlignment: "viewport",
        rotation: 0,
      });

      map.on("dragstart", onInteractStart);
      map.on("zoomstart", onInteractStart);
      map.on("rotatestart", onInteractStart);
      map.on("dragend", onInteractEnd);
      map.on("zoomend", onInteractEnd);
      map.on("rotateend", onInteractEnd);

      map.on("error", (e) => {
        if (cancelled) return;
        console.warn("[NavigationMap]", e?.error?.message || e?.message || e);
      });

      map.on("load", () => {
        if (cancelled || mapRef.current !== map) return;
        try {
          map.addSource("trail", { type: "geojson", data: emptyLineCollection() });
          map.addSource("offroute", { type: "geojson", data: emptyLineCollection() });

          map.addLayer({
            id: "trail-line",
            type: "line",
            source: "trail",
            paint: { "line-color": "#2D4F1E", "line-width": 5, "line-opacity": 1 },
            layout: { "line-cap": "round", "line-join": "round" },
          });
          map.addLayer({
            id: "offroute-line",
            type: "line",
            source: "offroute",
            paint: {
              "line-color": "#ff6b00",
              "line-width": 3,
              "line-opacity": 0.9,
              "line-dasharray": [2, 1.6],
            },
            layout: { "line-cap": "round", "line-join": "round" },
          });

          map.resize();
          setReady(true);
        } catch (err) {
          if (cancelled) return;
          console.error("[NavigationMap] load failed", err);
          setInitError(err?.message || "Mappa non disponibile");
        }
      });

      ro = new ResizeObserver(() => {
        if (cancelled) return;
        try {
          map.resize();
        } catch {
          /* ignore */
        }
      });
      ro.observe(el);

      resizeTimers = [40, 160, 400].map((ms) =>
        setTimeout(() => {
          if (cancelled) return;
          try {
            map.resize();
          } catch {
            /* ignore */
          }
        }, ms)
      );
    } catch (err) {
      console.error("[NavigationMap] init failed", err);
      setInitError(err?.message || "Mappa non disponibile");
      return undefined;
    }

    return () => {
      cancelled = true;
      if (interactTimer) clearTimeout(interactTimer);
      resizeTimers.forEach(clearTimeout);
      try {
        ro?.disconnect();
      } catch {
        /* ignore */
      }
      try {
        map.off("dragstart", onInteractStart);
        map.off("zoomstart", onInteractStart);
        map.off("rotatestart", onInteractStart);
        map.off("dragend", onInteractEnd);
        map.off("zoomend", onInteractEnd);
        map.off("rotateend", onInteractEnd);
      } catch {
        /* ignore */
      }
      try {
        markerRef.current?.remove();
      } catch {
        /* ignore */
      }
      markerRef.current = null;
      markerRotRef.current = null;
      markerOnMapRef.current = false;
      try {
        map.remove();
      } catch {
        /* ignore */
      }
      if (mapRef.current === map) mapRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    setLineSource(map, "trail", line);

    const key = `${line.length}:${line[0]?.[0]}:${line[0]?.[1]}:${line[line.length - 1]?.[0]}`;
    if (line.length > 1 && fittedTrailKeyRef.current !== key) {
      fittedTrailKeyRef.current = key;
      const ll = toLngLat(position);
      if (ll) {
        try {
          if (map.getZoom() < 14.5) map.jumpTo({ center: ll, zoom: 16 });
          else map.setCenter(ll);
        } catch {
          /* ignore */
        }
      } else {
        try {
          const bounds = new maplibregl.LngLatBounds();
          line.forEach((p) => {
            const c = toLngLat(p);
            if (c) bounds.extend(c);
          });
          if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 18, duration: 0 });
        } catch {
          /* ignore */
        }
      }
    }
  }, [ready, line, position]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    setLineSource(
      map,
      "offroute",
      offRouteLine && offRouteLine.length === 2 ? offRouteLine : null
    );
  }, [ready, offRouteLine]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    try {
      if (compassOn) {
        map.dragRotate.disable();
        map.touchZoomRotate.disableRotation();
        followPausedUntilRef.current = 0;
        const ll = toLngLat(positionRef.current);
        const live = headingLiveRefProp.current?.current;
        const h =
          typeof live === "number" && !Number.isNaN(live)
            ? live
            : typeof headingRef.current === "number" && !Number.isNaN(headingRef.current)
              ? headingRef.current
              : map.getBearing();
        map.stop();
        if (ll) map.jumpTo({ center: ll, bearing: h });
        else map.setBearing(h);
        displayRef.current.heading = h;
        displayRef.current.markerHeading = h;
        lastRecenterAtRef.current = Date.now();
      } else {
        map.dragRotate.enable();
        map.touchZoomRotate.enableRotation();
        map.stop();
        map.easeTo({ bearing: 0, duration: 280, essential: true });
        displayRef.current.heading = 0;
      }
    } catch {
      /* ignore */
    }
  }, [ready, compassOn]);

  useEffect(() => {
    if (!ready) return undefined;
    let raf = 0;
    let alive = true;
    lastFrameTsRef.current = performance.now();

    const tick = (now) => {
      if (!alive) return;
      raf = requestAnimationFrame(tick);

      const map = mapRef.current;
      const marker = markerRef.current;
      if (!map || !marker) return;

      const prevTs = lastFrameTsRef.current || now;
      const dt = Math.max(0, Math.min(48, now - prevTs));
      lastFrameTsRef.current = now;

      const targetLl = toLngLat(positionRef.current);
      const live = headingLiveRefProp.current?.current;
      const fromLive = typeof live === "number" && !Number.isNaN(live) ? live : null;
      const fromProp =
        typeof headingRef.current === "number" && !Number.isNaN(headingRef.current)
          ? headingRef.current
          : null;
      const targetH = fromLive ?? fromProp;

      const d = displayRef.current;
      if (targetLl) {
        if (d.lng == null || d.lat == null) {
          d.lng = targetLl[0];
          d.lat = targetLl[1];
        } else {
          d.lng = lerp(d.lng, targetLl[0], POS_FOLLOW);
          d.lat = lerp(d.lat, targetLl[1], POS_FOLLOW);
        }
      }

      const compass = compassOnRef.current;
      if (targetH != null) {
        const tau = compass ? COMPASS_BEARING_TAU_MS : MARKER_HEADING_TAU_MS;
        const alpha = expSmoothAlpha(dt, tau);
        if (d.heading == null) {
          d.heading = targetH;
        } else if (compass) {
          // Rate-limit solo in track-up: evita scatti su salti di heading.
          const maxStep = (COMPASS_MAX_BEARING_RATE_DEG_S * dt) / 1000;
          const delta = shortestAngleDeltaDeg(d.heading, targetH);
          const limited =
            Math.abs(delta) <= maxStep
              ? targetH
              : normalizeAngleDeg(d.heading + Math.sign(delta) * maxStep);
          d.heading = lerpAngleDeg(d.heading, limited, alpha);
        } else {
          d.heading = lerpAngleDeg(d.heading, targetH, alpha);
        }
        if (d.markerHeading == null) d.markerHeading = targetH;
        else d.markerHeading = lerpAngleDeg(d.markerHeading, targetH, alpha);
      }

      if (d.lng == null || d.lat == null) return;
      const displayLl = [d.lng, d.lat];

      try {
        if (!markerOnMapRef.current) {
          marker.setLngLat(displayLl);
          marker.addTo(map);
          markerOnMapRef.current = true;
        } else {
          marker.setLngLat(displayLl);
        }

        const rotEl = markerRotRef.current;
        const followOk =
          compass && !userZoomingRef.current && Date.now() >= followPausedUntilRef.current;

        if (compass) {
          // Track-up nativo: tip fissa in alto, ruota la mappa con jumpTo/setBearing.
          marker.setRotationAlignment("viewport");
          marker.setRotation(0);
          if (rotEl) rotEl.style.transform = "rotate(0deg)";

          if (followOk && d.heading != null) {
            const curB = map.getBearing();
            const bearingDelta = Math.abs(shortestAngleDeltaDeg(curB, d.heading));
            const needBearing = bearingDelta >= COMPASS_BEARING_DEADBAND_DEG;

            const nowMs = Date.now();
            let needCenter = false;
            if (nowMs - lastRecenterAtRef.current >= COMPASS_RECENTER_MIN_MS) {
              const c = map.getCenter();
              const moved = approxDistanceMeters(c.lng, c.lat, displayLl[0], displayLl[1]);
              if (moved >= COMPASS_RECENTER_MIN_M) {
                needCenter = true;
                lastRecenterAtRef.current = nowMs;
              }
            }

            if (needCenter && needBearing) {
              map.jumpTo({ center: displayLl, bearing: d.heading });
            } else if (needCenter) {
              map.setCenter(displayLl);
            } else if (needBearing) {
              map.setBearing(d.heading);
            }
          }
        } else {
          // Nord-up: solo freccia in CSS (gia' fluida). La mappa resta a bearing 0.
          marker.setRotationAlignment("viewport");
          marker.setRotation(0);
          const mh = d.markerHeading ?? 0;
          const screenRot = normalizeAngleDeg(mh - map.getBearing());
          if (rotEl) rotEl.style.transform = `rotate(${screenRot}deg)`;
        }
      } catch {
        /* ignore */
      }
    };

    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [ready]);

  if (initError) {
    return (
      <div
        className="pinewood-nav-maplibre"
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#d0d5d0",
          color: "#3a3a3a",
          padding: 16,
          textAlign: "center",
          fontFamily: "sans-serif",
          fontSize: 14,
        }}
      >
        {initError}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="pinewood-nav-maplibre"
      style={{ width: "100%", height: "100%", background: "#d0d5d0" }}
    />
  );
}
