/** Su iOS Safari va chiesto nel gesto utente (tap Play) prima della navigazione. */
export async function requestCompassPermission() {
  try {
    const DOE = window.DeviceOrientationEvent;
    if (DOE && typeof DOE.requestPermission === "function") {
      const perm = await DOE.requestPermission();
      return perm === "granted";
    }
    return true;
  } catch {
    return false;
  }
}
