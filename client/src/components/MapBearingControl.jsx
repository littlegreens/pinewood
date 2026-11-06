import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";

/**
 * Rotazione mappa via CSS sul mapPane.
 * - compassOn: bearing = heading GPS/bussola (track-up / head-up)
 * - compassOff: bearing = manualBearing (gesture 2 dita) oppure 0 = nord in alto
 */
export default function MapBearingControl({
  compassOn = false,
  headingDeg = null,
  manualBearing = 0,
  onManualBearingChange,
  pivotLatLng = null,
}) {
  const map = useMap();
  const gestureRef = useRef(null);
  const manualRef = useRef(manualBearing);
  manualRef.current = manualBearing;

  useEffect(() => {
    const pane = map.getPane?.("mapPane");
    if (!pane) return;

    const apply = () => {
      const bearing = compassOn
        ? typeof headingDeg === "number" && !Number.isNaN(headingDeg)
          ? headingDeg
          : 0
        : Number(manualRef.current) || 0;

      if (!bearing) {
        pane.style.transform = "";
        pane.style.transformOrigin = "";
        return;
      }

      let origin = "50% 50%";
      if (pivotLatLng && Array.isArray(pivotLatLng) && pivotLatLng.length >= 2) {
        try {
          const pt = map.latLngToContainerPoint(pivotLatLng);
          origin = `${pt.x}px ${pt.y}px`;
        } catch {
          /* ignore */
        }
      }
      pane.style.transformOrigin = origin;
      pane.style.transform = `rotate(${-bearing}deg)`;
    };

    apply();
    map.on("move", apply);
    map.on("zoom", apply);
    map.on("zoomend", apply);
    map.on("resize", apply);
    return () => {
      map.off("move", apply);
      map.off("zoom", apply);
      map.off("zoomend", apply);
      map.off("resize", apply);
      pane.style.transform = "";
      pane.style.transformOrigin = "";
    };
  }, [map, compassOn, headingDeg, manualBearing, pivotLatLng]);

  // Gesture 2 dita: ruota solo con bussola spenta
  useEffect(() => {
    if (compassOn) return;
    const el = map.getContainer();
    if (!el) return;

    const angleOf = (t0, t1) => Math.atan2(t1.clientY - t0.clientY, t1.clientX - t0.clientX);

    const onStart = (e) => {
      if (e.touches.length !== 2) return;
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

    const onEnd = () => {
      gestureRef.current = null;
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
