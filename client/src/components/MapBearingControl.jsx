import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";

function normalizeDeg(deg) {
  return ((Number(deg) % 360) + 360) % 360;
}

function quantizeDeg(deg, step = 6) {
  if (typeof deg !== "number" || Number.isNaN(deg)) return 0;
  return normalizeDeg(Math.round(deg / step) * step);
}

/**
 * Ruota SOLO tile + overlay (traccia), mai mapPane/markerPane.
 * Così Leaflet tiene il suo translate per pan/zoom e il fulcro resta il centro.
 *
 * - Bussola ON: bearing = heading (strada track-up). Override 2 dita temporaneo ? al rilascio torna.
 * - Bussola OFF: bearing = rotazione manuale 2 dita (nord-up).
 * Fuori traccia: non tocca nulla di speciale (nessun freeze).
 */
export default function MapBearingControl({
  compassOn = false,
  headingDeg = null,
  manualBearing = 0,
  onManualBearingChange,
}) {
  const map = useMap();
  const gestureRef = useRef(null);
  const lastAppliedRef = useRef(null);
  const tempOverrideRef = useRef(null); // solo in track-up durante 2 dita
  const compassOnRef = useRef(compassOn);
  const headingRef = useRef(headingDeg);
  const manualRef = useRef(manualBearing);
  compassOnRef.current = compassOn;
  headingRef.current = headingDeg;
  manualRef.current = manualBearing;

  const getPanes = () =>
    ["tilePane", "overlayPane", "shadowPane"].map((n) => map.getPane?.(n)).filter(Boolean);

  const clearMapPaneHack = () => {
    const mapPane = map.getPane?.("mapPane");
    if (mapPane) {
      // Non azzerare il translate di Leaflet: togli solo rotate se l'avevamo messo per errore in passato.
      const t = mapPane.style.transform || "";
      if (t.includes("rotate")) {
        mapPane.style.transform = "";
        mapPane.style.transformOrigin = "";
      }
    }
    for (const name of ["markerPane", "tooltipPane", "popupPane"]) {
      const p = map.getPane?.(name);
      if (!p) continue;
      p.style.transform = "";
      p.style.transformOrigin = "";
      p.style.willChange = "";
    }
  };

  const applyBearing = (raw) => {
    const panes = getPanes();
    if (!panes.length) return;
    const bearing = quantizeDeg(raw, 6);
    if (lastAppliedRef.current === bearing) return;
    lastAppliedRef.current = bearing;
    for (const pane of panes) {
      if (!bearing) {
        pane.style.transform = "";
        pane.style.transformOrigin = "";
        pane.style.willChange = "";
      } else {
        // Centro del pane = centro viewport (i sotto-pane riempiono il container).
        pane.style.transformOrigin = "50% 50%";
        pane.style.transform = `rotate(${-bearing}deg)`;
      }
    }
  };

  const resolveBearing = () => {
    if (tempOverrideRef.current != null) return tempOverrideRef.current;
    if (compassOnRef.current) {
      return typeof headingRef.current === "number" && !Number.isNaN(headingRef.current)
        ? headingRef.current
        : 0;
    }
    return Number(manualRef.current) || 0;
  };

  useEffect(() => {
    clearMapPaneHack();
    applyBearing(resolveBearing());
    return () => {
      for (const pane of getPanes()) {
        pane.style.transform = "";
        pane.style.transformOrigin = "";
        pane.style.willChange = "";
      }
      lastAppliedRef.current = null;
      tempOverrideRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    applyBearing(resolveBearing());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compassOn, headingDeg, manualBearing]);

  // 2 dita: nord-up = bearing permanente; track-up = override temporaneo poi snap al heading.
  useEffect(() => {
    const el = map.getContainer();
    if (!el) return;

    const angleOf = (t0, t1) => Math.atan2(t1.clientY - t0.clientY, t1.clientX - t0.clientX);

    const onStart = (e) => {
      if (e.touches.length !== 2) {
        gestureRef.current = null;
        return;
      }
      const base = compassOnRef.current
        ? typeof headingRef.current === "number" && !Number.isNaN(headingRef.current)
          ? headingRef.current
          : 0
        : Number(manualRef.current) || 0;
      gestureRef.current = {
        startAngle: angleOf(e.touches[0], e.touches[1]),
        startBearing: tempOverrideRef.current ?? base,
      };
    };

    const onMove = (e) => {
      if (e.touches.length !== 2 || !gestureRef.current) return;
      e.preventDefault();
      const cur = angleOf(e.touches[0], e.touches[1]);
      const deltaDeg = ((cur - gestureRef.current.startAngle) * 180) / Math.PI;
      let next = normalizeDeg(gestureRef.current.startBearing - deltaDeg);
      if (compassOnRef.current) {
        tempOverrideRef.current = next;
        applyBearing(next);
      } else {
        onManualBearingChange?.(next);
      }
    };

    const onEnd = (e) => {
      if (e.touches && e.touches.length >= 2) return;
      gestureRef.current = null;
      if (compassOnRef.current && tempOverrideRef.current != null) {
        // Torna all’orientamento heading (strada dritta davanti).
        tempOverrideRef.current = null;
        applyBearing(resolveBearing());
      }
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [map, onManualBearingChange]);

  return null;
}
