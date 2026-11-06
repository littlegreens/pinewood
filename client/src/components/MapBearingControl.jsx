import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";

/** Quantizza gradi: meno transform CSS ? mappa meno a scatti. */
function quantizeDeg(deg, step = 5) {
  if (typeof deg !== "number" || Number.isNaN(deg)) return 0;
  const q = Math.round(deg / step) * step;
  return ((q % 360) + 360) % 360;
}

/**
 * Ruota tile + overlay attorno al centro schermo.
 * I marker non ruotano: in track-up la punta resta in alto.
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
  const compassOnRef = useRef(compassOn);
  const headingRef = useRef(headingDeg);
  const manualRef = useRef(manualBearing);
  compassOnRef.current = compassOn;
  headingRef.current = headingDeg;
  manualRef.current = manualBearing;

  useEffect(() => {
    const panes = ["tilePane", "overlayPane", "shadowPane"]
      .map((n) => map.getPane?.(n))
      .filter(Boolean);
    if (!panes.length) return;

    let raf = 0;
    const apply = (bearingRaw) => {
      const bearing = quantizeDeg(bearingRaw, 5);
      if (lastAppliedRef.current === bearing) return;
      lastAppliedRef.current = bearing;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        for (const pane of panes) {
          if (!bearing) {
            pane.style.transform = "";
            pane.style.transformOrigin = "";
          } else {
            pane.style.transformOrigin = "50% 50%";
            pane.style.transform = `rotate(${-bearing}deg)`;
            pane.style.willChange = "transform";
          }
        }
      });
    };

    const tick = () => {
      const bearing = compassOnRef.current
        ? typeof headingRef.current === "number" && !Number.isNaN(headingRef.current)
          ? headingRef.current
          : 0
        : Number(manualRef.current) || 0;
      apply(bearing);
    };

    tick();
    return () => {
      cancelAnimationFrame(raf);
      for (const pane of panes) {
        pane.style.transform = "";
        pane.style.transformOrigin = "";
        pane.style.willChange = "";
      }
      lastAppliedRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    const panes = ["tilePane", "overlayPane", "shadowPane"]
      .map((n) => map.getPane?.(n))
      .filter(Boolean);
    const raw = compassOn
      ? typeof headingDeg === "number" && !Number.isNaN(headingDeg)
        ? headingDeg
        : 0
      : Number(manualBearing) || 0;
    const bearing = quantizeDeg(raw, 5);
    if (lastAppliedRef.current === bearing) return;
    lastAppliedRef.current = bearing;
    for (const pane of panes) {
      if (!bearing) {
        pane.style.transform = "";
        pane.style.transformOrigin = "";
      } else {
        pane.style.transformOrigin = "50% 50%";
        pane.style.transform = `rotate(${-bearing}deg)`;
      }
    }
  }, [map, compassOn, headingDeg, manualBearing]);

  useEffect(() => {
    if (compassOn) return;
    const el = map.getContainer();
    if (!el) return;

    const angleOf = (t0, t1) => Math.atan2(t1.clientY - t0.clientY, t1.clientX - t0.clientX);

    const onStart = (e) => {
      if (e.touches.length !== 2) {
        gestureRef.current = null;
        return;
      }
      gestureRef.current = {
        startAngle: angleOf(e.touches[0], e.touches[1]),
        startBearing: manualRef.current || 0,
      };
    };

    const onMove = (e) => {
      if (e.touches.length !== 2 || !gestureRef.current) return;
      e.preventDefault();
      const cur = angleOf(e.touches[0], e.touches[1]);
      const deltaDeg = ((cur - gestureRef.current.startAngle) * 180) / Math.PI;
      let next = gestureRef.current.startBearing - deltaDeg;
      next = ((next % 360) + 360) % 360;
      onManualBearingChange?.(next);
    };

    const onEnd = (e) => {
      if (!e.touches || e.touches.length < 2) gestureRef.current = null;
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
  }, [map, compassOn, onManualBearingChange]);

  return null;
}
