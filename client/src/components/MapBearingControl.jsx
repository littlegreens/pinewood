import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";

function normalizeDeg(deg) {
  return ((Number(deg) % 360) + 360) % 360;
}

function quantizeDeg(deg, step = 4) {
  if (typeof deg !== "number" || Number.isNaN(deg)) return 0;
  return normalizeDeg(Math.round(deg / step) * step);
}

/**
 * Ruota SOLO tile + overlay (traccia), mai mapPane/markerPane.
 * Fulcro SEMPRE centro del container mappa (50% 50%), indipendente dal GPS.
 *
 * compassOn: bearing = heading (track-up)
 * !compassOn: bearing = manualBearing (2 dita)
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

  const getPanes = () =>
    ["tilePane", "overlayPane", "shadowPane"].map((n) => map.getPane?.(n)).filter(Boolean);

  const scrubBadTransforms = () => {
    // Pulisce rotazioni residue sul mapPane (non devono mai stare lì).
    const mapPane = map.getPane?.("mapPane");
    if (mapPane && /rotate/i.test(mapPane.style.transform || "")) {
      mapPane.style.transform = "";
      mapPane.style.transformOrigin = "";
    }
    for (const name of ["markerPane", "tooltipPane", "popupPane"]) {
      const p = map.getPane?.(name);
      if (!p) continue;
      p.style.transform = "";
      p.style.transformOrigin = "";
    }
  };

  const applyBearing = (raw) => {
    const panes = getPanes();
    if (!panes.length) return;
    const bearing = quantizeDeg(raw, 4);
    if (lastAppliedRef.current === bearing) return;
    lastAppliedRef.current = bearing;
    for (const pane of panes) {
      // Fulcro = centro viewport mappa (i pane riempiono il container).
      pane.style.transformOrigin = "50% 50%";
      if (!bearing) {
        pane.style.transform = "";
      } else {
        pane.style.transform = `rotate(${-bearing}deg)`;
      }
    }
  };

  const resolveBearing = () => {
    if (compassOnRef.current) {
      return typeof headingRef.current === "number" && !Number.isNaN(headingRef.current)
        ? headingRef.current
        : 0;
    }
    return Number(manualRef.current) || 0;
  };

  useEffect(() => {
    scrubBadTransforms();
    applyBearing(resolveBearing());
    return () => {
      for (const pane of getPanes()) {
        pane.style.transform = "";
        pane.style.transformOrigin = "";
      }
      lastAppliedRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    applyBearing(resolveBearing());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compassOn, headingDeg, manualBearing]);

  // Rotazione 2 dita: fulcro centro schermo. Solo con bussola OFF (nord-up).
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
        startBearing: Number(manualRef.current) || 0,
      };
    };

    const onMove = (e) => {
      if (e.touches.length !== 2 || !gestureRef.current) return;
      e.preventDefault();
      const cur = angleOf(e.touches[0], e.touches[1]);
      const deltaDeg = ((cur - gestureRef.current.startAngle) * 180) / Math.PI;
      const next = normalizeDeg(gestureRef.current.startBearing - deltaDeg);
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
