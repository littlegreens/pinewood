import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Dimensions,
  Platform,
} from "react-native";
import LeafletMap from "../components/LeafletMap";
import Svg, { Path, Text as SvgText } from "react-native-svg";
import Header from "../components/Header";
import AppBanner from "../components/AppBanner";
import OwnerAvatar from "../components/OwnerAvatar";
import {
  HikingIcon,
  StarBorderIcon,
  FileDownloadIcon,
  CloudDownloadIcon,
  PlayArrowIcon,
  SaveTrailStarIcon,
  ZoomOutMapIcon,
  ZoomInMapIcon,
  WbSunnyIcon,
  CloudIcon,
  UmbrellaIcon,
  AcUnitIcon,
  ThunderstormIcon,
} from "../components/SvgIcons";
import * as FileSystem from "expo-file-system/legacy";
import { saveFileToDownloads } from "../utils/saveToDownloads";
import {
  apiFetch,
  apiUrl,
  getStoredAccessToken,
  getStoredUserProfile,
  subscribeAuth,
} from "../services/api";
import { colors, fonts, spacing, borderRadius } from "../theme";
import {
  formatKm,
  formatMeters,
  formatMinutesToHours,
  flattenGeoJsonCoordinates,
  geoJsonToTrailPoints,
} from "../utils/geo";
import { detectLanguage, t } from "../services/i18n";
import { getLastKnownPosition } from "../services/location";
import {
  downloadTilesForTrail,
  loadTrailOffline,
  saveTrailOffline,
} from "../services/offlineMaps";

const { width: SCREEN_W } = Dimensions.get("window");

const POLYLINE_COLOR = "#2D4F1E";
const DARK_BG = "#0f2517";
const MAP_COLLAPSED = 260;
const MAP_EXPANDED = 480;

function stripHtml(html) {
  if (!html) return "";
  return String(html)
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*p\s*>/gi, "\n\n")
    .replace(/<\/\s*div\s*>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .trim();
}

function splitDescriptionParagraphs(raw) {
  const plain = stripHtml(raw);
  const byBlank = plain
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\n/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (byBlank.length >= 2) return byBlank;
  const one = byBlank[0] || plain.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  if (!one) return [];
  const sentences = one.split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean);
  if (sentences.length <= 2) return [one];
  const chunks = [];
  for (let i = 0; i < sentences.length; i += 2) {
    chunks.push(sentences.slice(i, i + 2).join(" "));
  }
  return chunks;
}

function detectRouteType(coords) {
  if (!coords || coords.length < 2) return null;
  const [startLon, startLat] = coords[0];
  const [endLon, endLat] = coords[coords.length - 1];
  const meters =
    Math.sqrt((startLat - endLat) ** 2 + (startLon - endLon) ** 2) * 111320;
  return meters <= 250 ? "Anello" : "Lineare";
}

function buildElevationPath(profile, width, height, pad) {
  const MIN_SPAN = 90;
  const minD = profile[0].distance_m;
  const maxD = profile[profile.length - 1].distance_m || minD + 1;
  const elevs = profile.map((p) => p.elevation_m);
  const minE = Math.min(...elevs);
  const maxE = Math.max(...elevs);
  const spanD = Math.max(1, maxD - minD);
  const rawSpanE = maxE - minE;
  const padE = Math.max(0, (MIN_SPAN - rawSpanE) / 2);
  const plotMinE = minE - padE;
  const plotMaxE = maxE + padE;
  const spanE = Math.max(1, plotMaxE - plotMinE);
  const points = profile.map((p) => {
    const x = pad + ((p.distance_m - minD) / spanD) * (width - pad * 2);
    const y = height - pad - ((p.elevation_m - plotMinE) / spanE) * (height - pad * 2);
    return { x, y };
  });
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  return { d, minE: Math.round(minE), maxE: Math.round(maxE) };
}

function WeatherIconComponent({ code, size = 26 }) {
  const color = weatherIconColor(code);
  if (code == null) return <CloudIcon size={size} color={color} />;
  if (code === 0 || code === 1) return <WbSunnyIcon size={size} color={color} />;
  if (code === 2 || code === 3 || code === 45 || code === 48) return <CloudIcon size={size} color={color} />;
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return <UmbrellaIcon size={size} color={color} />;
  if (code >= 71 && code <= 77) return <AcUnitIcon size={size} color={color} />;
  if (code >= 95) return <ThunderstormIcon size={size} color={color} />;
  return <CloudIcon size={size} color={color} />;
}

function weatherIconColor(code) {
  if (code == null) return "#78909c";
  if (code === 0 || code === 1) return "#f6b93b";
  if (code === 2 || code === 3 || code === 45 || code === 48) return "#78909c";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "#4a90e2";
  if (code >= 71 && code <= 77) return "#64b5f6";
  if (code >= 95) return "#8e44ad";
  return "#78909c";
}

function dayLabel(dateIso, lang) {
  const d = new Date(dateIso);
  return d.toLocaleDateString(lang === "it" ? "it-IT" : "en-US", {
    weekday: "short",
    day: "2-digit",
  });
}

export default function TrailDetailScreen({ route, navigation }) {
  const { trailId } = route.params;
  const lang = useMemo(() => detectLanguage(), []);

  const [trail, setTrail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [forecastDays, setForecastDays] = useState([]);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [me, setMe] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [playStarting, setPlayStarting] = useState(false);
  const [offlineBusy, setOfflineBusy] = useState(false);
  const [banner, setBanner] = useState({ message: "", type: "success" });
  const showBanner = useCallback((type, message) => {
    setBanner({ type, message });
  }, []);

  useEffect(() => {
    async function refreshAuth() {
      const [token, profile] = await Promise.all([
        getStoredAccessToken(),
        getStoredUserProfile(),
      ]);
      setIsLoggedIn(Boolean(token));
      setMe(profile);
    }
    refreshAuth();
    const unsub = subscribeAuth(() => refreshAuth());
    return unsub;
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await apiFetch(`/api/trails/${trailId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (active) setTrail(data);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [trailId]);

  useEffect(() => {
    if (!trail) return;
    const startCoords =
      trail.start_point_geojson?.coordinates?.length === 2
        ? [trail.start_point_geojson.coordinates[1], trail.start_point_geojson.coordinates[0]]
        : null;
    const lat =
      trail.start_location_lat != null
        ? Number(trail.start_location_lat)
        : startCoords?.[0] ?? null;
    const lon =
      trail.start_location_lon != null
        ? Number(trail.start_location_lon)
        : startCoords?.[1] ?? null;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    let active = true;
    async function loadForecast() {
      try {
        const res = await apiFetch(`/api/weather/forecast?lat=${lat}&lon=${lon}&days=7`);
        if (!res.ok) return;
        const data = await res.json();
        if (active) setForecastDays(Array.isArray(data.days) ? data.days : []);
      } catch {}
    }
    loadForecast();
    return () => { active = false; };
  }, [trail]);

  const mapCoords = useMemo(() => {
    return geoJsonToTrailPoints(trail?.geom_geojson).map(({ latitude, longitude }) => ({
      latitude,
      longitude,
    }));
  }, [trail?.geom_geojson]);

  const geoJsonCoords = useMemo(
    () => flattenGeoJsonCoordinates(trail?.geom_geojson),
    [trail?.geom_geojson],
  );
  const elevationProfile = Array.isArray(trail?.elevation_profile) ? trail.elevation_profile : [];
  const hasElevation =
    trail?.parse_status !== "processing_elevation" &&
    trail?.parse_status !== "ready_no_elevation" &&
    elevationProfile.length > 1;
  const isGuest = !isLoggedIn;
  const trailPathLatLng = useMemo(
    () => mapCoords.map((c) => [c.latitude, c.longitude]),
    [mapCoords],
  );

  const mapRef = useRef(null);

  useEffect(() => {
    if (mapExpanded) {
      setTimeout(() => mapRef.current?.invalidate(), 300);
    }
  }, [mapExpanded]);

  const toggleSaved = useCallback(async () => {
    if (isGuest || !trail || trail.is_mine) return;
    const method = trail.is_saved ? "DELETE" : "POST";
    const url = trail.is_saved ? `/api/saved-trails/${trail.id}` : "/api/saved-trails";
    const body = trail.is_saved ? undefined : JSON.stringify({ trailId: trail.id });
    const res = await apiFetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body,
    });
    if (!res.ok) return;
    setTrail((prev) =>
      prev
        ? {
            ...prev,
            is_saved: !prev.is_saved,
            saves_count: Math.max(0, (prev.saves_count ?? 0) + (prev.is_saved ? -1 : 1)),
          }
        : prev
    );
  }, [trail, isGuest]);

  const startOfflineNavigation = useCallback(async () => {
    const cached = await loadTrailOffline(trailId);
    const hasLine = Boolean(cached?.geom_geojson?.coordinates?.length);
    if (!hasLine) {
      showBanner("warning", t(lang, "offlinePlayUnavailable"));
      return false;
    }
    navigation.navigate("Navigation", {
      sessionId: `local_${trailId}_${Date.now()}`,
      trailId: String(trailId),
      offlineSession: true,
      initialPosition: getLastKnownPosition(),
    });
    return true;
  }, [trailId, lang, navigation, showBanner]);

  const startNavigation = useCallback(async () => {
    if (isGuest) {
      showBanner("warning", t(lang, "guestPlayNotAllowed"));
      return;
    }
    if (!mapCoords.length) {
      showBanner("error", "Tracciato non disponibile.");
      return;
    }
    if (playStarting) return;

    const token = await getStoredAccessToken();
    if (!token) {
      showBanner("error", "Sessione scaduta. Effettua di nuovo il login.");
      return;
    }

    setPlayStarting(true);
    try {
      const numericTrailId = Number(trailId);
      const res = await apiFetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trailId: Number.isFinite(numericTrailId) ? numericTrailId : trailId,
        }),
        timeoutMs: 30000,
      });
      if (res.status === 401) {
        showBanner("error", "Sessione scaduta. Effettua di nuovo il login per avviare la navigazione.");
        return;
      }
      if (!res.ok) {
        const started = await startOfflineNavigation();
        if (!started) {
          const errText = await res.text().catch(() => "");
          showBanner(
            "error",
            `Impossibile avviare la sessione (${res.status})${errText ? `: ${errText.slice(0, 80)}` : ""}`,
          );
        }
        return;
      }
      const data = await res.json();
      if (!data.sessionId) {
        showBanner("error", "Risposta del server non valida.");
        return;
      }
      navigation.navigate("Navigation", {
        sessionId: data.sessionId,
        trailId: String(trailId),
        initialPosition: getLastKnownPosition(),
      });
    } catch (err) {
      const started = await startOfflineNavigation();
      if (!started) {
        if (err?.name === "AbortError") {
          showBanner("error", "Il server non risponde. Controlla la connessione.");
        } else {
          showBanner("error", err?.message || t(lang, "genericError"));
        }
      }
    } finally {
      setPlayStarting(false);
    }
  }, [
    isGuest,
    mapCoords.length,
    trailId,
    playStarting,
    lang,
    navigation,
    startOfflineNavigation,
    showBanner,
  ]);

  const forceOfflineForTrail = useCallback(async () => {
    if (isGuest) {
      showBanner("warning", t(lang, "guestOfflineNotAllowed"));
      return;
    }
    if (!trail) return;
    if (!mapCoords.length) {
      showBanner("error", t(lang, "trailNoGeometry"));
      return;
    }
    if (offlineBusy) return;
    setOfflineBusy(true);
    showBanner("warning", t(lang, "offlineDownloading"));
    try {
      const line = mapCoords.map((c) => [c.latitude, c.longitude]);
      const out = await downloadTilesForTrail(line);
      if (!out.ok) {
        showBanner("error", t(lang, "mapWarmupFailed"));
        return;
      }
      await saveTrailOffline(trailId, {
        name: trail.name,
        geom_geojson: trail.geom_geojson,
        elevation_profile: trail.elevation_profile,
        waypoints: trail.waypoints,
      });
      const done = (out.downloaded || 0) + (out.skipped || 0);
      const partial = out.total > 0 && done < out.total * 0.85;
      showBanner(
        partial ? "warning" : "success",
        partial ? t(lang, "mapWarmupPartial") : t(lang, "offlineReadyMsg"),
      );
    } catch (err) {
      showBanner("error", err?.message || t(lang, "mapWarmupFailed"));
    } finally {
      setOfflineBusy(false);
    }
  }, [isGuest, mapCoords, offlineBusy, trail, trailId, lang, showBanner]);

  const downloadGpx = useCallback(async () => {
    if (isGuest) {
      showBanner("warning", t(lang, "guestGpxNotAllowed"));
      return;
    }
    if (!trail) return;
    try {
      const token = await getStoredAccessToken();
      const safeName = String(trail.name || "trail")
        .replace(/[^\w.-]+/g, "_")
        .replace(/_+/g, "_");
      const fileUri = `${FileSystem.cacheDirectory}${safeName}.gpx`;
      const result = await FileSystem.downloadAsync(
        apiUrl(`/api/trails/download-gpx/${trail.id}`),
        fileUri,
        token ? { headers: { Authorization: `Bearer ${token}` } } : {},
      );
      if (result.status !== 200) {
        showBanner("error", t(lang, "gpxDownloadError"));
        return;
      }
      const saved = await saveFileToDownloads(result.uri, `${safeName}.gpx`);
      showBanner(
        "success",
        saved.location === "downloads"
          ? t(lang, "gpxSavedToDownloads")
          : t(lang, "gpxSavedToAppFiles"),
      );
    } catch (err) {
      showBanner("error", err?.message || t(lang, "gpxDownloadError"));
    }
  }, [trail, isGuest, lang, showBanner]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Header showBack title="" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.pineGreen} />
        </View>
      </View>
    );
  }

  if (!trail) {
    return (
      <View style={styles.container}>
        <Header showBack title="" />
        <View style={styles.centered}>
          <Text style={styles.emptyText}>{t(lang, "genericError")}</Text>
        </View>
      </View>
    );
  }

  const routeType = trail.route_type || detectRouteType(geoJsonCoords);
  const svgH = 130;

  return (
    <View style={styles.container}>
      <Header showBack title="" />
      <AppBanner
        message={banner.message}
        type={banner.type}
        onDismiss={() => setBanner({ message: "", type: "success" })}
        durationMs={offlineBusy ? 0 : 3000}
        topOffset={Platform.OS === "ios" ? 96 : 80}
      />
      <ScrollView style={styles.flex} bounces={false} nestedScrollEnabled>
        {/* ?? Name / Owner / Chips ?? */}
        <View style={styles.topSection}>
          <View style={styles.nameRow}>
            <Text style={styles.trailName} numberOfLines={3}>
              {trail.name}
            </Text>
            <View style={styles.nameRight}>
              {trail.source === "osm" && (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>CAI</Text>
                </View>
              )}
              {!trail.is_mine && !isGuest && (
                <TouchableOpacity
                  onPress={toggleSaved}
                  activeOpacity={0.7}
                  style={styles.starBtn}
                >
                  <SaveTrailStarIcon size={26} filled={Boolean(trail.is_saved)} />
                </TouchableOpacity>
              )}
            </View>
          </View>
          <View style={styles.ownerRow}>
            <OwnerAvatar
              avatarUrl={trail.owner_avatar_url}
              name={trail.owner_name || "Pinewood"}
              size={24}
              style={styles.avatar}
            />
            <Text style={styles.ownerName}>
              {t(lang, "trailUploadedBy")} {trail.owner_name || "Pinewood"}
            </Text>
          </View>
        </View>

        {/* ?? Map ?? */}
        {mapCoords.length > 0 && (
          <View style={{ height: mapExpanded ? MAP_EXPANDED : MAP_COLLAPSED }}>
            <View
              style={StyleSheet.absoluteFill}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderTerminationRequest={() => false}
            >
              <LeafletMap
                ref={mapRef}
                style={StyleSheet.absoluteFill}
                mode="trail"
                trailPath={trailPathLatLng}
                waypoints={trail?.waypoints || []}
                useOfflineTiles
                interactive
              />
            </View>
            <TouchableOpacity
              style={styles.expandBtn}
              onPress={() => setMapExpanded((v) => !v)}
              activeOpacity={0.85}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {mapExpanded ? (
                <ZoomInMapIcon size={20} color="#111" />
              ) : (
                <ZoomOutMapIcon size={20} color="#111" />
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Dark info bar (PWA style) */}
        <View style={styles.darkBar}>
          {(trail.hikers_count > 0 || trail.saves_count > 0) && (
            <View style={styles.darkRow}>
              <HikingIcon size={16} color="#fff" />
              <Text style={styles.darkVal}>{trail.hikers_count ?? 0}</Text>
              <View style={{ width: 10 }} />
              <StarBorderIcon size={16} color="#fff" />
              <Text style={styles.darkVal}>{trail.saves_count ?? 0}</Text>
            </View>
          )}
          {(trail.distance_km != null || trail.difficulty) && (
            <View style={styles.darkRow}>
              {trail.distance_km != null && (
                <Text style={styles.darkText}>
                  <Text style={styles.darkBold}>{t(lang, "trailDistance")}: </Text>{formatKm(trail.distance_km)}
                </Text>
              )}
              {trail.difficulty && (
                <Text style={[styles.darkText, { marginLeft: 16 }]}>
                  <Text style={styles.darkBold}>{t(lang, "difficulty")}: </Text>{trail.difficulty}
                </Text>
              )}
            </View>
          )}
          {(trail.elevation_gain_m != null || trail.elevation_loss_m != null) && (
            <Text style={styles.darkText}>
              <Text style={styles.darkBold}>{t(lang, "trailElevationDelta")}: </Text>
              ↑{formatMeters(trail.elevation_gain_m)} | ↓{formatMeters(trail.elevation_loss_m)}
            </Text>
          )}
          {(trail.min_elevation_m != null || trail.max_elevation_m != null) && (
            <View style={styles.darkRow}>
              {trail.min_elevation_m != null && (
                <Text style={styles.darkText}>
                  <Text style={styles.darkBold}>Min: </Text>{formatMeters(trail.min_elevation_m)}
                </Text>
              )}
              {trail.max_elevation_m != null && (
                <Text style={[styles.darkText, { marginLeft: 16 }]}>
                  <Text style={styles.darkBold}>Max: </Text>{formatMeters(trail.max_elevation_m)}
                </Text>
              )}
            </View>
          )}
          {trail.estimated_time_minutes != null && (
            <Text style={styles.darkText}>
              <Text style={styles.darkBold}>{t(lang, "trailEstimatedTime")}: </Text>
              {formatMinutesToHours(trail.estimated_time_minutes)}
            </Text>
          )}
          {routeType && (
            <Text style={styles.darkText}>
              <Text style={styles.darkBold}>{t(lang, "trailType")}: </Text>{routeType}
            </Text>
          )}
        </View>

        {trail.description ? (
          <View style={styles.descSection}>
            {splitDescriptionParagraphs(trail.description).map((p, i, arr) => (
              <Text
                key={`desc-${i}`}
                style={[
                  styles.descriptionText,
                  i < arr.length - 1 ? styles.descriptionParagraphGap : null,
                ]}
              >
                {p}
              </Text>
            ))}
          </View>
        ) : null}

        {trail.start_location_text ? (
          <View style={styles.descSection}>
            <Text style={styles.descriptionText}>
              <Text style={{ fontFamily: fonts.bold }}>{t(lang, "trailDeparture")}: </Text>
              {trail.start_location_text}
            </Text>
          </View>
        ) : null}

        {forecastDays.length > 0 && (
          <View style={styles.weatherSection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {forecastDays.slice(0, 7).map((day) => (
                <View key={day.date} style={styles.weatherCard}>
                  <Text style={styles.weatherDay}>{dayLabel(day.date, lang)}</Text>
                  <WeatherIconComponent code={day.weather_code} size={26} />
                  <Text style={styles.weatherTemp}>
                    {Math.round(day.temp_max_c ?? 0)}° / {Math.round(day.temp_min_c ?? 0)}°
                  </Text>
                  <Text style={styles.weatherRain}>
                    {t(lang, "weatherRain")} {day.rain_prob_pct ?? "--"}%
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.elevSection}>
          <Text style={styles.elevTitle}>{t(lang, "elevationProfile")}</Text>
          {hasElevation ? (
            <Svg width={SCREEN_W} height={svgH} viewBox={`0 0 ${SCREEN_W} ${svgH}`}>
              {(() => {
                const ep = buildElevationPath(elevationProfile, SCREEN_W, svgH, 6);
                return (
                  <>
                    <Path
                      d={ep.d}
                      fill="none"
                      stroke={POLYLINE_COLOR}
                      strokeWidth={2.2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <SvgText x={8} y={svgH - 2} fontSize={11} fill="#666">
                      {ep.minE}m
                    </SvgText>
                    <SvgText x={SCREEN_W - 56} y={12} fontSize={11} fill="#666">
                      {ep.maxE}m
                    </SvgText>
                  </>
                );
              })()}
            </Svg>
          ) : (
            <Text style={styles.noDataText}>{t(lang, "trail.no_elevation")}</Text>
          )}
        </View>

        {/* ?? Action buttons ?? */}
        <View style={styles.actionsRow}>
          <View style={styles.actionsLeft}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.gpxBtn, isGuest && styles.actionDisabled]}
              onPress={downloadGpx}
              disabled={isGuest}
              activeOpacity={0.7}
              accessibilityLabel={t(lang, "gpxDownload")}
            >
              <FileDownloadIcon size={26} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.offlineBtn, (offlineBusy || isGuest) && styles.actionDisabled]}
              onPress={forceOfflineForTrail}
              disabled={offlineBusy || isGuest}
              activeOpacity={0.7}
              accessibilityLabel={t(lang, "mapForceOffline")}
            >
              {offlineBusy ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <CloudDownloadIcon size={26} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.actionBtn, styles.playBtn, (playStarting || isGuest) && styles.actionDisabled]}
            onPress={startNavigation}
            disabled={playStarting || isGuest}
            activeOpacity={0.7}
          >
            <PlayArrowIcon size={28} color="#fff" />
          </TouchableOpacity>
        </View>

        {isGuest && (
          <Text style={styles.guestHint}>{t(lang, "guestReadOnlyHint")}</Text>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { fontFamily: fonts.regular, fontSize: 15, color: colors.slateGray },

  topSection: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 },
  nameRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  trailName: { flex: 1, fontFamily: fonts.bold, fontSize: 20, color: colors.black, marginRight: 8 },
  nameRight: { flexDirection: "column", alignItems: "flex-end", gap: 6 },
  starBtn: { padding: 2 },
  chipsRow: { flexDirection: "row", gap: 6, marginTop: 3 },
  chip: {
    backgroundColor: colors.pineGreen,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: borderRadius.pill,
  },
  chipText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.white },

  ownerRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  avatar: { width: 24, height: 24, borderRadius: 12, marginRight: 7 },
  avatarPlaceholder: {
    backgroundColor: "#e0e0e0",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: { fontFamily: fonts.bold, fontSize: 12, color: colors.slateGray },
  ownerName: { fontFamily: fonts.regular, fontSize: 13, color: colors.slateGray },

  expandBtn: {
    position: "absolute",
    right: 10,
    bottom: 10,
    zIndex: 20,
    elevation: 20,
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.86)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },

  darkBar: {
    backgroundColor: DARK_BG,
    paddingVertical: 20,
    paddingHorizontal: 16,
    gap: 6,
    marginBottom: 2,
  },
  darkRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  darkText: { fontFamily: fonts.regular, fontSize: 15, color: "#fff", lineHeight: 22 },
  darkBold: { fontFamily: fonts.bold },
  darkVal: { fontFamily: fonts.semibold, fontSize: 14, color: "#fff", marginLeft: 4 },

  descSection: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  descriptionText: { fontFamily: fonts.regular, fontSize: 14, color: "#2f2f2f", lineHeight: 22 },
  descriptionParagraphGap: { marginBottom: 16 },
  noDataText: { fontFamily: fonts.regular, fontSize: 14, color: colors.slateGray },

  elevSection: { paddingTop: 12, paddingBottom: 6 },
  elevTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.black, marginBottom: 8, paddingHorizontal: 16 },

  weatherSection: { paddingTop: 10, paddingBottom: 6, backgroundColor: "#eef1f3" },
  weatherCard: {
    width: SCREEN_W / 3,
    alignItems: "center",
    paddingVertical: 12,
    borderRightWidth: 1,
    borderRightColor: "#b9c1c8",
  },
  weatherDay: { fontFamily: fonts.bold, fontSize: 12, color: colors.black, marginBottom: 4 },
  weatherTemp: { fontFamily: fonts.bold, fontSize: 13, color: colors.black, marginTop: 4 },
  weatherRain: { fontFamily: fonts.regular, fontSize: 11, color: colors.slateGray, marginTop: 2 },

  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  actionsLeft: { flexDirection: "row", gap: 12 },
  actionBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  gpxBtn: { backgroundColor: "#8b5a2b" },
  offlineBtn: { backgroundColor: "#d97706" },
  playBtn: { backgroundColor: colors.pineGreen },
  actionDisabled: { opacity: 0.45 },

  guestHint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.slateGray,
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
});
