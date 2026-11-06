import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";

/** Gradoni larghi = meno tremolio. */
function quantizeDeg(deg, step = 8) {
  if (typeof deg !== "number" || Number.isNaN(deg)) return 0;
  const q = Math.round(deg / step) * step;
  return ((q % 360) + 360) % 360;
}

/**
 * Ruota l’intero mapPane (tile + traccia + marker + popup) insieme.
 * Così la freccia, i POI e la linea restano allineati e non “spariscono”.
 * Fuori traccia: congela il bearing (niente tremolio).
 */
export default function MapBearingControl({
  compassOn = false,
  headingDeg = null,
  manualBearing = 0,
  onManualBearingChange,
  freezeBearing = false,
}) {
  const map = useMap();
  const gestureRef = useRef(null);
  const lastAppliedRef = useRef(null);
  const frozenBearingRef = useRef(0);
  const compassOnRef = useRef(compassOn);
  const headingRef = useRef(headingDeg);
  const manualRef = useRef(manualBearing);
  const freezeRef = useRef(freezeBearing);
  compassOnRef.current = compassOn;
  headingRef.current = headingDeg;
  manualRef.current = manualBearing;
  freezeRef.current = freezeBearing;

  useEffect(() => {
    const mapPane = map.getPane?.("mapPane");
    if (!mapPane) return;

    // Pulisci transform spezzati sui sotto-pane (causavano layer fantasma).
    for (const name of ["tilePane", "overlayPane", "shadowPane", "markerPane", "tooltipPane", "popupPane"]) {
      const p = map.getPane?.(name);
      if (!p) continue;
      p.style.transform = "";
      p.style.transformOrigin = "";
      p.style.willChange = "";
    }

    const apply = (bearingRaw) => {
      const bearing = quantizeDeg(bearingRaw, 8);
      if (lastAppliedRef.current === bearing) return;
      lastAppliedRef.current = bearing;
      if (!bearing) {
        mapPane.style.transform = "";
        mapPane.style.transformOrigin = "";
        mapPane.style.willChange = "";
      } else {
        mapPane.style.transformOrigin = "50% 50%";
        mapPane.style.transform = `rotate(${-bearing}deg)`;
        mapPane.style.willChange = "transform";
      }
      // Contro-rotazione testo popup (leggibile) e freccia gestita a parte via heading assoluto.
      map.getContainer()?.style.setProperty("--pw-map-bearing", String(bearing));
    };

    const resolveBearing = () => {
      if (freezeRef.current) return frozenBearingRef.current;
      const next = compassOnRef.current
        ? typeof headingRef.current === "number" && !Number.isNaN(headingRef.current)
          ? headingRef.current
          : 0
        : Number(manualRef.current) || 0;
      frozenBearingRef.current = next;
      return next;
    };

    apply(resolveBearing());
    return () => {
      mapPane.style.transform = "";
      mapPane.style.transformOrigin = "";
      mapPane.style.willChange = "";
      map.getContainer()?.style.removeProperty("--pw-map-bearing");
      lastAppliedRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    const mapPane = map.getPane?.("mapPane");
    if (!mapPane) return;
    let raw;
    if (freezeBearing) {
      raw = frozenBearingRef.current;
    } else {
      raw = compassOn
        ? typeof headingDeg === "number" && !Number.isNaN(headingDeg)
          ? headingDeg
          : 0
        : Number(manualBearing) || 0;
      frozenBearingRef.current = raw;
    }
    const bearing = quantizeDeg(raw, 8);
    if (lastAppliedRef.current === bearing) return;
    lastAppliedRef.current = bearing;
    if (!bearing) {
      mapPane.style.transform = "";
      mapPane.style.transformOrigin = "";
    } else {
      mapPane.style.transformOrigin = "50% 50%";
      mapPane.style.transform = `rotate(${-bearing}deg)`;
    }
    map.getContainer()?.style.setProperty("--pw-map-bearing", String(bearing));
  }, [map, compassOn, headingDeg, manualBearing, freezeBearing]);

  useEffect(() => {
    if (compassOn || freezeBearing) return;
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
  }, [map, compassOn, freezeBearing, onManualBearingChange]);

  return null;
}
