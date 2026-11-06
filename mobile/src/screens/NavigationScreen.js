import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  Alert,
} from "react-native";
import LeafletMap from "../components/LeafletMap";
import Svg, { Path, Line, Polygon, G, Text as SvgText } from "react-native-svg";
import { StopIcon, MyLocationIcon } from "../components/SvgIcons";
import AppBanner from "../components/AppBanner";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Speech from "expo-speech";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { apiFetch } from "../services/api";
import {
  startWatching,
  stopWatching,
  subscribePosition,
  toCoords,
  startBackgroundTracking,
  stopBackgroundTracking,
} from "../services/location";
import {
  NAV_BG_TASK_NAME,
  configureNavigation,
  clearNavigation,
  setNavigationListeners,
  processNavigationPosition,
  computeCumulativeDistances,
  getNavigationRuntimeSnapshot,
} from "../services/navigationEngine";
import { geoJsonToTrailPoints } from "../utils/geo";
import { loadTrailOffline } from "../services/offlineMaps";
import {
  buildElevationProfilePath,
  normalizeElevationProfile,
} from "../utils/elevationProfilePath";
import { detectLanguage, t } from "../services/i18n";
import { colors, fonts } from "../theme";

const { width: SCREEN_W } = Dimensions.get("window");
const ELEV_W = SCREEN_W - 32;
const ELEV_H = 80;
const DARK_GREEN = "#102115";

export default function NavigationScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { sessionId, trailId, offlineSession: offlineSessionParam } = route.params;
  const isOfflineLocalSession = useMemo(
    () => String(sessionId || "").startsWith("local_") || offlineSessionParam === true,
    [sessionId, offlineSessionParam],
  );
  const lang = useMemo(() => detectLanguage(), []);
  const insets = useSafeAreaInsets();

  const mapRef = useRef(null);
  const stoppingRef = useRef(false);

  const [trailLine, setTrailLine] = useState([]);
  const [elevationProfile, setElevationProfile] = useState([]);
  const [userPos, setUserPos] = useState(null);
  const [heading, setHeading] = useState(null);
  const [isOffRoute, setIsOffRoute] = useState(false);
  const [offRouteDistM, setOffRouteDistM] = useState(null);
  const [reconnectPoint, setReconnectPoint] = useState(null);
  const [actualTrack, setActualTrack] = useState([]);
  const [deviationsCount, setDeviationsCount] = useState(0);
  const [userDistanceM, setUserDistanceM] = useState(null);

  const cumulativeDistances = useMemo(() => {
    const line = trailLine
      .filter((c) => Number.isFinite(c.latitude) && Number.isFinite(c.longitude))
      .map((c) => [c.latitude, c.longitude]);
    return computeCumulativeDistances(line);
  }, [trailLine]);

  const totalTrailM = useMemo(() => {
    const last = cumulativeDistances[cumulativeDistances.length - 1];
    return Number.isFinite(last) && last > 0 ? last : 1;
  }, [cumulativeDistances]);

  useEffect(() => {
    setNavigationListeners({
      onUserPos: setUserPos,
      onHeading: setHeading,
      onAlongTrail: (along, minDist, nearest) => {
        setUserDistanceM(along);
        setOffRouteDistM(typeof minDist === "number" && Number.isFinite(minDist) ? minDist : null);
        setReconnectPoint(Array.isArray(nearest) ? nearest : null);
      },
      onOffRouteChange: (off, count) => {
        setIsOffRoute(off);
        setDeviationsCount(count);
        if (!off) setReconnectPoint(null);
      },
      onTrack: setActualTrack,
    });
    return () => clearNavigation();
  }, []);

  useEffect(() => {
    if (trailLine.length < 2) return;
    configureNavigation({
      lang,
      sessionId,
      trailLine,
      cumulativeDistances,
      totalTrailM,
    });
  }, [trailLine, cumulativeDistances, totalTrailM, lang, sessionId]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        let mapped = [];
        let elevationProfile = [];

        if (isOfflineLocalSession && trailId) {
          const cached = await loadTrailOffline(trailId);
          mapped = geoJsonToTrailPoints(cached?.geom_geojson);
          elevationProfile = cached?.elevation_profile;
        } else {
          const res = await apiFetch(`/api/sessions/${sessionId}`);
          if (!active) return;
          if (!res.ok) {
            Alert.alert("Errore", "Impossibile caricare la sessione.");
            navigation.goBack();
            return;
          }
          const data = await res.json();
          mapped = geoJsonToTrailPoints(data?.geom_geojson);
          elevationProfile = data?.elevation_profile;

          if (mapped.length === 0 && trailId) {
            const trailRes = await apiFetch(`/api/trails/${trailId}`);
            if (trailRes.ok) {
              const trail = await trailRes.json();
              mapped = geoJsonToTrailPoints(trail?.geom_geojson);
              if (Array.isArray(trail?.elevation_profile) && trail.elevation_profile.length > 1) {
                elevationProfile = trail.elevation_profile;
              }
            }
          }
        }

        if (!active) return;
        if (mapped.length === 0) {
          Alert.alert("", "Tracciato non disponibile.");
          navigation.goBack();
          return;
        }

        setTrailLine(mapped);
        setElevationProfile(normalizeElevationProfile(elevationProfile, mapped));
      } catch {
        if (active) {
          Alert.alert("Errore", t(lang, "genericError"));
          navigation.goBack();
        }
      }
    })();
    return () => { active = false; };
  }, [sessionId, trailId, navigation, lang, isOfflineLocalSession]);

  useEffect(() => {
    activateKeepAwakeAsync("navigation").catch(() => {});
    startWatching({ highAccuracy: true, intervalMs: 2000, distanceM: 3 });

    (async () => {
      const ok = await startBackgroundTracking(NAV_BG_TASK_NAME);
      if (!ok && Platform.OS === "android") {
        Alert.alert(
          "GPS in background",
          "Senza permesso «posizione sempre» gli avvisi fuori traccia possono fermarsi se blocchi lo schermo. Concedi il permesso nelle impostazioni di Pinewood.",
        );
      }
    })();

    const unsub = subscribePosition((snap) => {
      const pos = toCoords(snap);
      if (!pos) return;
      const heading =
        snap && !Array.isArray(snap) && typeof snap.heading === "number" ? snap.heading : null;
      const compassHeading =
        snap && !Array.isArray(snap) && typeof snap.compassHeading === "number"
          ? snap.compassHeading
          : null;
      const speed =
        snap && !Array.isArray(snap) && typeof snap.speed === "number" ? snap.speed : null;
      const accuracy =
        snap && !Array.isArray(snap) && typeof snap.accuracy === "number" ? snap.accuracy : null;
      processNavigationPosition(pos, heading, speed, accuracy, compassHeading);
    });

    return () => {
      unsub();
      stopWatching();
      stopBackgroundTracking(NAV_BG_TASK_NAME).catch(() => {});
      deactivateKeepAwake("navigation");
    };
  }, []);

  const handleStop = useCallback(async () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    const snap = getNavigationRuntimeSnapshot();
    if (!isOfflineLocalSession) {
      try {
        await apiFetch(`/api/sessions/${sessionId}/finish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            completion_pct: null,
            deviations_count: snap.deviationsCount,
            actual_geom: snap.actualTrack,
          }),
        });
      } catch {
        /* ignore */
      }
    }
    Speech.stop();
    clearNavigation();
    stopWatching();
    try {
      await stopBackgroundTracking(NAV_BG_TASK_NAME);
    } catch {
      /* ignore */
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else if (trailId) {
      navigation.replace("TrailDetail", { trailId: String(trailId) });
    } else {
      navigation.navigate("MapDiscover");
    }
    stoppingRef.current = false;
  }, [sessionId, navigation, trailId, isOfflineLocalSession]);

  const handleCenter = useCallback(() => {
    if (!mapRef.current || !userPos) return;
    mapRef.current.locate(userPos[0], userPos[1], 15);
  }, [userPos]);

  const elevProfilePath = useMemo(() => {
    if (elevationProfile.length < 2) return null;
    const topGap = 16;
    const innerH = ELEV_H - topGap;
    const pad = 8;
    const path = buildElevationProfilePath(elevationProfile, ELEV_W, innerH, pad);
    if (!path) return null;
    return { ...path, topGap, innerH };
  }, [elevationProfile]);

  const userElevX = useMemo(() => {
    if (userDistanceM == null || !elevProfilePath) return null;
    const { minD, maxD, spanD, pad, width } = elevProfilePath;
    const along = Math.max(minD, Math.min(maxD, userDistanceM));
    return pad + ((along - minD) / spanD) * (width - pad * 2);
  }, [userDistanceM, elevProfilePath]);

  const progress = useMemo(() => {
    if (userDistanceM == null || !Number.isFinite(totalTrailM) || totalTrailM <= 0) return 0;
    const pct = userDistanceM / totalTrailM;
    if (!Number.isFinite(pct)) return 0;
    return Math.max(0, Math.min(1, pct));
  }, [userDistanceM, totalTrailM]);

  const trailPathLatLng = useMemo(
    () => trailLine.map((c) => [c.latitude, c.longitude]),
    [trailLine],
  );

  return (
    <View style={styles.root}>
      <LeafletMap
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        mode="navigation"
        trailPath={trailPathLatLng}
        actualPath={actualTrack}
        userPosition={userPos}
        heading={heading}
        reconnectPath={
          isOffRoute && userPos && reconnectPoint ? [userPos, reconnectPoint] : null
        }
        followUser
        useOfflineTiles
        interactive
      />

      <View style={styles.topBar}>
        {elevProfilePath ? (
          <Svg width={ELEV_W} height={ELEV_H}>
            {userElevX != null && (
              <Polygon
                points={`${userElevX - 5},2 ${userElevX + 5},2 ${userElevX},11`}
                fill="#ffffff"
                stroke="rgba(255,255,255,0.4)"
                strokeWidth={0.6}
              />
            )}
            {userElevX != null && (
              <Line
                x1={userElevX}
                x2={userElevX}
                y1={12}
                y2={ELEV_H - 8}
                stroke="#ffffff"
                strokeWidth={1.8}
                strokeDasharray="6,5"
                opacity={0.92}
              />
            )}
            <G transform={`translate(0, ${elevProfilePath.topGap})`}>
              <Path
                d={elevProfilePath.d}
                fill="none"
                stroke="#ffffff"
                strokeWidth={2}
                strokeLinecap="round"
              />
              <SvgText x={6} y={elevProfilePath.innerH - 4} fontSize={10} fill="#dfe8df">
                {elevProfilePath.minE}m
              </SvgText>
              <SvgText x={ELEV_W - 50} y={10} fontSize={10} fill="#dfe8df">
                {elevProfilePath.maxE}m
              </SvgText>
            </G>
          </Svg>
        ) : (
          <Text style={styles.topBarText}>
            {t(lang, "navWaitingGps")}
          </Text>
        )}
        <Text style={styles.progressText}>
          {userPos
            ? `${t(lang, "navigationActive")} · ${Math.round(progress * 100)}%`
            : t(lang, "navWaitingGps")}
        </Text>
      </View>

      <AppBanner
        message={
          isOffRoute
            ? t(lang, "navOffRouteAlertMeters").replace(
                "{m}",
                String(Math.max(1, Math.round(offRouteDistM || 0))),
              )
            : ""
        }
        type="warning"
        durationMs={0}
        topOffset={Platform.OS === "ios" ? insets.top + 120 : insets.top + 100}
      />

      <TouchableOpacity
        style={[
          styles.centerBtn,
          { top: (Platform.OS === "ios" ? 54 : 36) + ELEV_H + 56 },
        ]}
        onPress={handleCenter}
        activeOpacity={0.8}
      >
        <MyLocationIcon size={20} color="#111" />
      </TouchableOpacity>

      <View style={[styles.bottomBar, { bottom: insets.bottom + 28 }]}>
        <TouchableOpacity
          style={[styles.fabBtn, styles.fabStop]}
          onPress={handleStop}
          activeOpacity={0.8}
        >
          <StopIcon size={28} color={colors.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.black,
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: DARK_GREEN,
    paddingTop: Platform.OS === "ios" ? 54 : 36,
    paddingBottom: 10,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  topBarText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
  },
  progressText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.white,
    marginTop: 4,
  },
  centerBtn: {
    position: "absolute",
    right: 14,
    zIndex: 50,
    elevation: 50,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.94)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    zIndex: 50,
    elevation: 50,
  },
  fabBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
  },
  fabStop: {
    backgroundColor: "#c62828",
  },
  userDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#e8c85c",
    borderWidth: 1,
    borderColor: "#3a3a3a",
  },
});
