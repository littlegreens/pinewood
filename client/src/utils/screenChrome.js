/** Fullscreen documento (nasconde barre browser dove supportato). Chiamare da un gesto utente sincrono. */
export function requestDocumentFullscreen() {
  const el = document.documentElement;
  const req = el.requestFullscreen?.bind(el) ?? el.webkitRequestFullscreen?.bind(el);
  if (typeof req !== "function") return;
  try {
    const p = req();
    if (p != null && typeof p.catch === "function") p.catch(() => {});
  } catch {
    /* negato o non supportato */
  }
}

export function isDocumentFullscreenActive() {
  return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
}

/** API fullscreen su elemento (Chrome/Android); su iOS Safari di solito assente. */
export function isDocumentFullscreenSupported() {
  const el = document.documentElement;
  return typeof el.requestFullscreen === "function" || typeof el.webkitRequestFullscreen === "function";
}

export function exitDocumentFullscreen() {
  const d = document;
  const fsEl = d.fullscreenElement ?? d.webkitFullscreenElement;
  if (!fsEl) return;
  const ex = d.exitFullscreen?.bind(d) ?? d.webkitExitFullscreen?.bind(d);
  if (typeof ex !== "function") return;
  try {
    const p = ex();
    if (p != null && typeof p.catch === "function") p.catch(() => {});
  } catch {
    /* */
  }
}

/** Richiede portrait (spesso richiede fullscreen o gesto; iOS spesso ignora). */
export function lockPortraitOrientation() {
  try {
    const o = screen.orientation;
    if (o && typeof o.lock === "function") {
      const p = o.lock("portrait");
      if (p != null && typeof p.catch === "function") p.catch(() => {});
    }
  } catch {
    /* */
  }
}

export function unlockOrientation() {
  try {
    screen.orientation?.unlock?.();
  } catch {
    /* */
  }
}
