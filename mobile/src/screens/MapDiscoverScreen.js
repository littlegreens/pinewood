import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import LeafletMap from "../components/LeafletMap";
import { useNavigation } from "@react-navigation/native";
import Header from "../components/Header";
import OwnerAvatar from "../components/OwnerAvatar";
import { apiFetch } from "../services/api";
import { getQuickPosition, subscribePosition, toCoords } from "../services/location";
import { distanceMeters, geocode } from "../utils/geo";
import { detectLanguage, t } from "../services/i18n";
import { colors, fonts, borderRadius } from "../theme";

const GEO_RADIUS_KM = 100;

function formatMinutesToHours(min) {
  if (!Number.isFinite(Number(min))) return null;
  const total = Number(min);
  const h = Math.floor(total / 60);
  const m = Math.round(total % 60);
  if (h <= 0) return `${m} min`;
  return `${h} h ${m} min`;
}

function formatMeters(v) {
  if (!Number.isFinite(Number(v))) return null;
  return `${Math.round(Number(v))} m`;
}

export default function MapDiscoverScreen() {
  const navigation = useNavigation();
  const lang = useMemo(() => detectLanguage(), []);
  const mapRef = useRef(null);

  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");
  const [geoResult, setGeoResult] = useState(null);
  const [userPos, setUserPos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  const [selectedTrail, setSelectedTrail] = useState(null);
  const [trailPath, setTrailPath] = useState([]);
  const [pathLoading, setPathLoading] = useState(false);

  const debounceRef = useRef(null);
  const geoAbortRef = useRef(false);
  const pathCache = useRef(new Map());

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const pos = await getQuickPosition();
        if (pos && active) setUserPos(pos);
        const qs = pos ? `?sort=near&lat=${pos[0]}&lon=${pos[1]}` : "";
        const res = await apiFetch(`/api/trails/discover${qs}`);
        if (!res.ok || !active) return;
        const data = await res.json();
        const points = (Array.isArray(data) ? data : [])
          .filter(
            (tr) =>
              Number.isFinite(Number(tr.start_lat)) &&
              Number.isFinite(Number(tr.start_lon)),
          )
          .map((tr) => ({
            id: tr.id,
            name: tr.name,
            distance_km: tr.distance_km,
            estimated_time_minutes: tr.estimated_time_minutes,
            difficulty: tr.difficulty,
            elevation_gain_m: tr.elevation_gain_m,
            elevation_loss_m: tr.elevation_loss_m,
            owner_name: tr.owner_name,
            owner_avatar_url: tr.owner_avatar_url,
            lat: Number(tr.start_lat),
            lon: Number(tr.start_lon),
          }));
        if (active) setItems(points);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => subscribePosition((snap) => setUserPos(toCoords(snap))), []);

  const initialFitDone = useRef(false);
  useEffect(() => {
    if (!mapReady || !items.length || initialFitDone.current) return;
    initialFitDone.current = true;
    mapRef.current?.fitPoints(items.map((p) => [p.lat, p.lon]));
  }, [mapReady, items]);

  useEffect(() => {
    setGeoResult(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    geoAbortRef.current = true;
    const trimmed = query.trim();
    if (trimmed.length < 3) return;
    const nameMatches = items.filter((p) =>
      String(p.name || "").toLowerCase().includes(trimmed.toLowerCase()),
    );
    if (nameMatches.length >= 3) return;
    let cancelled = false;
    geoAbortRef.current = false;
    debounceRef.current = setTimeout(async () => {
      if (cancelled || geoAbortRef.current) return;
      const result = await geocode(trimmed);
      if (cancelled || geoAbortRef.current) return;
      if (result) setGeoResult(result);
    }, 600);
    return () => { cancelled = true; };
  }, [query, items]);

  const filteredPoints = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (geoResult) {
      const geoPos = [geoResult.lat, geoResult.lon];
      return items.filter(
        (p) => distanceMeters(geoPos, [p.lat, p.lon]) <= GEO_RADIUS_KM * 1000,
      );
    }
    if (!q) return items;
    return items.filter((p) => String(p.name || "").toLowerCase().includes(q));
  }, [items, query, geoResult]);

  const trailPathLatLng = useMemo(
    () => trailPath.map((c) => [c.latitude, c.longitude]),
    [trailPath],
  );

  const revealTrail = useCallback(async (trail) => {
    if (selectedTrail?.id === trail.id) return;
    setSelectedTrail(trail);
    setTrailPath([]);

    if (pathCache.current.has(trail.id)) {
      const cached = pathCache.current.get(trail.id);
      setTrailPath(cached);
      return;
    }

    setPathLoading(true);
    try {
      const res = await apiFetch(`/api/trails/${trail.id}`);
      if (!res.ok) return;
      const detail = await res.json();
      const geom = detail.geom_geojson;
      let rawCoords = [];
      if (geom?.type === "MultiLineString") {
        rawCoords = (geom.coordinates ?? []).flat(1);
      } else {
        rawCoords = geom?.coordinates ?? [];
      }
      const mapped = rawCoords
        .filter((c) => Array.isArray(c) && c.length >= 2)
        .map((c) => ({ latitude: Number(c[1]), longitude: Number(c[0]) }));
      if (mapped.length >= 2) {
        pathCache.current.set(trail.id, mapped);
        setTrailPath(mapped);
      } else {
        mapRef.current?.locate(trail.lat, trail.lon, 14);
      }
    } catch {
      /* ignore */
    } finally {
      setPathLoading(false);
    }
  }, [selectedTrail?.id]);

  const closeCard = useCallback(() => {
    setSelectedTrail(null);
    setTrailPath([]);
    mapRef.current?.clearPath();
  }, []);

  const centerOnUser = useCallback(async () => {
    let pos = userPos;
    if (!pos) {
      pos = await getQuickPosition();
      if (pos) setUserPos(pos);
    }
    if (!pos) return;
    mapRef.current?.locate(pos[0], pos[1], 13);
  }, [userPos]);

  const clearGeo = useCallback(() => {
    setGeoResult(null);
    setQuery("");
  }, []);

  return (
    <View style={styles.container}>
      <Header />

      <View style={styles.mapWrapper}>
        <LeafletMap
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          mode="discover"
          points={filteredPoints}
          path={trailPathLatLng.length >= 2 ? trailPathLatLng : null}
          fitBottomPadding={selectedTrail ? 240 : 26}
          interactive
          onTrailPress={revealTrail}
          onMapPress={closeCard}
          onReady={() => setMapReady(true)}
        />

        <View style={styles.searchOverlay} pointerEvents="box-none">
          <View style={styles.searchRow}>
            <View style={styles.searchInputWrapper}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill={colors.slateGray} style={{ marginRight: 6 }}>
                <Path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
              </Svg>
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={(text) => { setQuery(text); closeCard(); }}
                placeholder={t(lang, "searchByNameOrPlace")}
                placeholderTextColor={colors.slateGray}
                returnKeyType="search"
                onSubmitEditing={() => Keyboard.dismiss()}
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => { setQuery(""); setGeoResult(null); closeCard(); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill={colors.slateGray}>
                    <Path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z" />
                  </Svg>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity style={styles.locateBtn} onPress={centerOnUser} activeOpacity={0.7}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill={colors.pineGreen}>
                <Path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" />
              </Svg>
            </TouchableOpacity>
          </View>

          {geoResult && (
            <View style={styles.chipRow}>
              <View style={styles.chip}>
                <Svg width={14} height={14} viewBox="0 0 24 24" fill={colors.pineGreen} style={{ marginRight: 4 }}>
                  <Path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </Svg>
                <Text style={styles.chipText} numberOfLines={1}>
                  Entro {GEO_RADIUS_KM} km da {geoResult.name}
                </Text>
                <TouchableOpacity onPress={clearGeo} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} style={{ marginLeft: 6 }}>
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill={colors.black}>
                    <Path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                  </Svg>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {selectedTrail && (
          <View style={styles.cardOverlay} pointerEvents="box-none">
            <View style={styles.card}>
              <TouchableOpacity style={styles.cardClose} onPress={closeCard}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill={colors.slateGray}>
                  <Path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </Svg>
              </TouchableOpacity>

              <Text style={styles.cardName} numberOfLines={2}>{selectedTrail.name}</Text>

              <View style={styles.cardMeta}>
                {selectedTrail.distance_km != null && (
                  <Text style={styles.metaText}>
                    {Number(selectedTrail.distance_km).toFixed(2).replace(".", ",")} km
                  </Text>
                )}
                {selectedTrail.estimated_time_minutes != null && (
                  <Text style={styles.metaText}>
                    | {formatMinutesToHours(selectedTrail.estimated_time_minutes)}
                  </Text>
                )}
                {selectedTrail.elevation_gain_m != null && (
                  <Text style={styles.metaText}>
                    | ↑{formatMeters(selectedTrail.elevation_gain_m)} ↓{formatMeters(selectedTrail.elevation_loss_m ?? selectedTrail.elevation_gain_m)}
                  </Text>
                )}
                {selectedTrail.difficulty && (
                  <Text style={styles.metaText}>| {selectedTrail.difficulty}</Text>
                )}
              </View>

              {pathLoading && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                  <ActivityIndicator size="small" color={colors.pineGreen} />
                  <Text style={styles.metaText}>Caricamento traccia...</Text>
                </View>
              )}

              <View style={styles.cardBottom}>
                <View style={styles.ownerRow}>
                  <OwnerAvatar
                    avatarUrl={selectedTrail.owner_avatar_url}
                    name={selectedTrail.owner_name || "Pinewood"}
                    size={20}
                    style={styles.ownerAvatar}
                  />
                  <Text style={styles.ownerText} numberOfLines={1}>
                    {t(lang, "trailUploadedBy")} {selectedTrail.owner_name || "Pinewood"}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.openBtn}
                  onPress={() => {
                    closeCard();
                    navigation.navigate("TrailDetail", { trailId: selectedTrail.id });
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.openBtnText}>Apri scheda</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {loading && (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color={colors.pineGreen} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  mapWrapper: { flex: 1, position: "relative" },
  searchOverlay: { position: "absolute", top: 10, left: 10, right: 10, zIndex: 10 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  searchInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingHorizontal: 10,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.black,
    paddingVertical: 0,
  },
  locateBtn: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.sm,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: "center",
    justifyContent: "center",
  },
  chipRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: borderRadius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.divider,
    maxWidth: "80%",
  },
  chipText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.black, flexShrink: 1 },
  cardOverlay: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 56,
    zIndex: 10,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#d9dee4",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 10,
  },
  cardClose: { position: "absolute", top: 10, right: 10, zIndex: 2, padding: 4 },
  cardName: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.black,
    lineHeight: 20,
    marginBottom: 6,
    paddingRight: 32,
  },
  cardMeta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4, marginBottom: 8 },
  metaText: { fontFamily: fonts.regular, fontSize: 13, color: colors.slateGray },
  cardBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  ownerRow: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  ownerAvatar: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#eee" },
  ownerAvatarFallback: { backgroundColor: colors.pineGreen, alignItems: "center", justifyContent: "center" },
  ownerText: { fontFamily: fonts.regular, fontSize: 12, color: colors.slateGray, flexShrink: 1 },
  openBtn: {
    backgroundColor: colors.pineGreen,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 10,
    elevation: 5,
  },
  openBtnText: { fontFamily: fonts.bold, fontSize: 13, color: colors.white },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.4)",
  },
});
