/** Beep + voce per fuori traccia (navigazione). */

export function playOffRouteBeep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.18);
    setTimeout(() => ctx.close().catch(() => {}), 300);
  } catch {
    /* ignore */
  }
}

/** Vibrazione fuori traccia (Android/Chrome ok; iOS Safari di solito non supporta). */
export function vibrateOffRoute() {
  try {
    const v = navigator?.vibrate;
    if (typeof v !== "function") return;
    const pattern = [0, 280, 100, 280, 100, 400];
    v.call(navigator, pattern);
    window.setTimeout(() => {
      try {
        v.call(navigator, [180, 80, 180]);
      } catch {
        /* ignore */
      }
    }, 450);
  } catch {
    /* ignore */
  }
}

/** Impulso breve mentre resti fuori traccia (ripetuto dal client con throttle). */
export function vibrateOffRoutePulse() {
  try {
    const v = navigator?.vibrate;
    if (typeof v !== "function") return;
    v.call(navigator, [140, 60, 140]);
  } catch {
    /* ignore */
  }
}

export function speakOffRouteMessage(text, lang) {
  if (!window.speechSynthesis || !text) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === "it" ? "it-IT" : "en-US";
    u.rate = 1;
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}
