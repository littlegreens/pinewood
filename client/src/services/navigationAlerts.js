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
    gain.gain.setValueAtTime(0.16, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.22);
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
    const pattern = [0, 450, 80, 450, 80, 480, 100, 400, 100, 480, 120, 420, 140, 380];
    v.call(navigator, pattern);
    window.setTimeout(() => {
      try {
        v.call(navigator, [0, 380, 70, 380, 70, 420, 90, 360, 90, 420, 110, 340]);
      } catch {
        /* ignore */
      }
    }, 450);
    window.setTimeout(() => {
      try {
        v.call(navigator, [0, 320, 60, 320, 60, 360, 80, 300]);
      } catch {
        /* ignore */
      }
    }, 900);
  } catch {
    /* ignore */
  }
}

/** Impulso mentre resti fuori traccia (ripetuto ~ogni secondo dal client). */
export function vibrateOffRoutePulse() {
  try {
    const v = navigator?.vibrate;
    if (typeof v !== "function") return;
    v.call(navigator, [0, 420, 70, 420, 70, 450, 90, 400, 90, 450, 110, 380, 130, 360]);
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
