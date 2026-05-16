import * as Battery from "expo-battery";
import * as Location from "expo-location";

let _batteryListener = null;
let _lowPowerMode = false;

export function isLowPowerMode() {
  return _lowPowerMode;
}

export async function initBatteryMonitor() {
  try {
    const level = await Battery.getBatteryLevelAsync();
    _lowPowerMode = level < 0.2;

    _batteryListener = Battery.addBatteryLevelListener(({ batteryLevel }) => {
      _lowPowerMode = batteryLevel < 0.2;
    });
  } catch {
    // battery API not available (simulator)
  }
}

export function stopBatteryMonitor() {
  if (_batteryListener) {
    _batteryListener.remove();
    _batteryListener = null;
  }
}

export function getLocationAccuracy() {
  if (_lowPowerMode) {
    return {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 5000,
      distanceInterval: 15,
    };
  }
  return {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 2000,
    distanceInterval: 5,
  };
}

export function getBackgroundLocationConfig() {
  if (_lowPowerMode) {
    return {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 8000,
      distanceInterval: 20,
      deferredUpdatesInterval: 8000,
      deferredUpdatesDistance: 20,
    };
  }
  return {
    accuracy: Location.Accuracy.High,
    timeInterval: 3000,
    distanceInterval: 8,
    deferredUpdatesInterval: 3000,
    deferredUpdatesDistance: 8,
  };
}
