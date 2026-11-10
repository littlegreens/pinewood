import { requestCompassPermission } from "./compassPermission.js";

function normalizeAngleDeg(v) {
  return ((v % 360) + 360) % 360;
}

function shortestAngleDeltaDeg(from, to) {
  let d = normalizeAngleDeg(to) - normalizeAngleDeg(from);
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

function screenOrientationOffsetDeg() {
  const angle = window.screen?.orientation?.angle;
  if (typeof angle === "number" && !Number.isNaN(angle)) return angle;
  if (typeof window.orientation === "number") return window.orientation;
  return 0;
}

/** Alpha ? heading grezzo (pu� essere relativo o assoluto a seconda dell'evento). */
function alphaToHeading(alpha) {
  return normalizeAngleDeg(360 - alpha - screenOrientationOffsetDeg());
}

/**
 * Fusione relative (frequente) + absolute (raro ma true-north).
 * Senza fusione: absolute manda 2 eventi e tace ? freccia bloccata;
 * oppure relative/absolute si pestano i piedi ? sembra �rotta�.
 */
export function subscribeDeviceHeading(onHeading) {
  let cancelled = false;
  const types = [];
  let lastRelative = null;
  /** Quanto aggiungere al relative per avvicinarsi al nord vero. */
  let relToAbsOffset = null;
  let lastEmitAt = 0;
  let watchdog = null;

  function emit(heading, meta) {
    if (cancelled || typeof heading !== "number" || Number.isNaN(heading)) return;
    lastEmitAt = Date.now();
    onHeading(normalizeAngleDeg(heading), meta);
  }

  function onEvent(ev) {
    if (cancelled || !ev) return;

    // iOS: webkitCompassHeading � gi� nord-vero e abbastanza frequente.
    if (typeof ev.webkitCompassHeading === "number" && !Number.isNaN(ev.webkitCompassHeading)) {
      const h = normalizeAngleDeg(ev.webkitCompassHeading + screenOrientationOffsetDeg());
      emit(h, { absolute: true, type: ev.type });
      return;
    }

    if (typeof ev.alpha !== "number" || Number.isNaN(ev.alpha)) return;
    const raw = alphaToHeading(ev.alpha);
    const isAbsolute =
      ev.type === "deviceorientationabsolute" || ev.absolute === true;

    if (isAbsolute) {
      if (lastRelative != null) {
        relToAbsOffset = shortestAngleDeltaDeg(lastRelative, raw);
      }
      emit(raw, { absolute: true, type: ev.type });
      return;
    }

    // Relative: frequente. Se abbiamo calibrazione absolute, allineiamo a nord.
    lastRelative = raw;
    if (relToAbsOffset != null) {
      emit(normalizeAngleDeg(raw + relToAbsOffset), { absolute: false, type: ev.type });
    } else {
      emit(raw, { absolute: false, type: ev.type });
    }
  }

  function attach() {
    if (cancelled) return;
    if (!types.includes("deviceorientation")) {
      window.addEventListener("deviceorientation", onEvent, { capture: true, passive: true });
      types.push("deviceorientation");
    }
    if ("ondeviceorientationabsolute" in window && !types.includes("deviceorientationabsolute")) {
      window.addEventListener("deviceorientationabsolute", onEvent, {
        capture: true,
        passive: true,
      });
      types.push("deviceorientationabsolute");
    }
  }

  function detach() {
    for (const t of types) {
      window.removeEventListener(t, onEvent, true);
    }
    types.length = 0;
  }

  function startWatchdog() {
    if (watchdog) clearInterval(watchdog);
    // Se per >2s non arriva nulla, riattacca i listener (bug frequenti su Android Chrome).
    watchdog = setInterval(() => {
      if (cancelled) return;
      if (Date.now() - lastEmitAt < 2000) return;
      detach();
      attach();
    }, 1500);
  }

  void (async () => {
    await requestCompassPermission();
    if (cancelled) return;
    attach();
    startWatchdog();
    lastEmitAt = Date.now();
  })();

  return () => {
    cancelled = true;
    if (watchdog) clearInterval(watchdog);
    detach();
  };
}
