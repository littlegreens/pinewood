import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { SvgXml } from "react-native-svg";
import Header from "../components/Header";
import {
  SearchIcon,
  AccessTimeIcon,
  SignalCellularAltIcon,
  LocationOnIcon,
  CancelIcon,
  FilterHdrIcon,
} from "../components/SvgIcons";
import { apiFetch } from "../services/api";
import { getQuickPosition, subscribePosition, toCoords } from "../services/location";
import { distanceMeters, geocode, formatMinutesToHours } from "../utils/geo";
import { detectLanguage, t } from "../services/i18n";
import { colors, fonts, spacing } from "../theme";

const PAGE_SIZE = 12;
const GEO_RADIUS_KM = 100;

export default function TrailsScreen() {
  const navigation = useNavigation();
  const lang = useMemo(() => detectLanguage(), []);

  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]);
  const [myPos, setMyPos] = useState(null);
  const [locationResolved, setLocationResolved] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [geoResult, setGeoResult] = useState(null);
  const [loading, setLoading] = useState(true);

  const debounceRef = useRef(null);
  const itemsRef = useRef(items);
  const loadedOnce = useRef(false);
  itemsRef.current = items;

  useEffect(() => {
    let active = true;
    const unsub = subscribePosition((snap) => {
      const pos = toCoords(snap);
      if (!active || !pos) return;
      setMyPos(pos);
      setLocationResolved(true);
    });
    getQuickPosition().then((pos) => {
      if (!active) return;
      if (pos) setMyPos(pos);
      setLocationResolved(true);
    });
    return () => {
      active = false;
      unsub();
    };
  }, []);

  useEffect(() => {
    if (!locationResolved || loadedOnce.current) return;
    loadedOnce.current = true;
    let active = true;

    (async () => {
      try {
        const qs = new URLSearchParams();
        qs.set("sort", "near");
        if (myPos) {
          qs.set("lat", String(myPos[0]));
          qs.set("lon", String(myPos[1]));
        }
        const res = await apiFetch(`/api/trails/discover?${qs.toString()}`);
        if (res.status === 401) { navigation.replace("Landing"); return; }
        if (!res.ok) return;
        const data = await res.json();
        if (active) setItems(data);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => { active = false; };
  }, [myPos, locationResolved]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setGeoResult(null);
      return;
    }

    const nameMatches = itemsRef.current.filter((tr) =>
      tr.name?.toLowerCase().includes(trimmed.toLowerCase()),
    );
    if (nameMatches.length >= 3) {
      setGeoResult(null);
      return;
    }

    let cancelled = false;
    debounceRef.current = setTimeout(async () => {
      if (cancelled) return;
      const result = await geocode(trimmed);
      if (cancelled) return;
      if (result) setGeoResult(result);
    }, 600);

    return () => { cancelled = true; };
  }, [query]);

  const itemsWithDist = useMemo(() => {
    return items.map((tr) => {
      if (!myPos || tr.start_lat == null || tr.start_lon == null) {
        return { ...tr, _myDist: Number.POSITIVE_INFINITY };
      }
      return {
        ...tr,
        _myDist: distanceMeters(myPos, [Number(tr.start_lat), Number(tr.start_lon)]),
      };
    });
  }, [items, myPos]);

  const results = useMemo(() => {
    const trimmed = query.trim().toLowerCase();

    if (geoResult) {
      const geoPos = [geoResult.lat, geoResult.lon];
      return itemsWithDist
        .map((tr) => {
          if (tr.start_lat == null || tr.start_lon == null) {
            return { ...tr, _geoDist: Number.POSITIVE_INFINITY };
          }
          return {
            ...tr,
            _geoDist: distanceMeters(geoPos, [Number(tr.start_lat), Number(tr.start_lon)]),
          };
        })
        .filter((tr) => tr._geoDist <= GEO_RADIUS_KM * 1000)
        .sort((a, b) => a._geoDist - b._geoDist);
    }

    if (trimmed) {
      const matches = itemsWithDist.filter((tr) =>
        tr.name?.toLowerCase().includes(trimmed),
      );
      if (matches.length > 0) {
        return [...matches].sort((a, b) => a._myDist - b._myDist);
      }
    }

    return [...itemsWithDist].sort((a, b) => a._myDist - b._myDist);
  }, [itemsWithDist, query, geoResult]);

  const visible = useMemo(
    () => results.slice(0, visibleCount),
    [results, visibleCount],
  );

  const handleLoadMore = useCallback(() => {
    setVisibleCount((v) => v + PAGE_SIZE);
  }, []);

  const renderCard = useCallback(({ item: trail }) => {
    const km =
      trail.distance_km != null
        ? `${Number(trail.distance_km).toFixed(1).replace(".", ",")} km`
        : null;
    const time = formatMinutesToHours(trail.estimated_time_minutes);

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        style={styles.card}
        onPress={() => navigation.navigate("TrailDetail", { trailId: trail.id })}
      >
        <View style={styles.cardThumb}>
          {trail.svg_preview ? (
            <SvgXml
              xml={trail.svg_preview.replace(/rect[^/]*fill="[^"]*"/g, (m) =>
                m.replace(/fill="[^"]*"/, 'fill="none"'),
              )}
              width={80}
              height={70}
            />
          ) : (
            <FilterHdrIcon size={30} color={colors.pineGreen} />
          )}
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.cardName} numberOfLines={2}>
            {trail.name}
          </Text>

          <View style={styles.cardMeta}>
            {km && <Text style={styles.metaText}>{km}</Text>}
            {time && (
              <View style={styles.metaItem}>
                <AccessTimeIcon size={13} color={colors.slateGray} />
                <Text style={styles.metaText}>{time}</Text>
              </View>
            )}
            {trail.difficulty && (
              <View style={styles.metaItem}>
                <SignalCellularAltIcon size={13} color={colors.slateGray} />
                <Text style={styles.metaText} numberOfLines={1}>
                  {trail.difficulty}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [navigation]);

  const ListHeader = useMemo(() => (
    <View style={styles.listHeader}>
      <View style={styles.searchWrap}>
        <SearchIcon size={18} color={colors.slateGray} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder={t(lang, "searchByNameOrPlace")}
          placeholderTextColor={colors.slateGray}
          returnKeyType="search"
          autoCorrect={false}
        />
      </View>

      <View style={styles.countRow}>
        <Text style={styles.countText}>
          {results.length} {t(lang, "tracciati")}
        </Text>

        {geoResult && (
          <TouchableOpacity
            style={styles.chip}
            activeOpacity={0.7}
            onPress={() => { setGeoResult(null); setQuery(""); }}
          >
            <LocationOnIcon size={14} color={colors.pineGreen} />
            <Text style={styles.chipText}>
              Entro {GEO_RADIUS_KM} km da {geoResult.name}
            </Text>
            <CancelIcon size={16} color={colors.slateGray} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  ), [query, lang, results.length, geoResult]);

  const ListFooter = useMemo(() => {
    if (visibleCount >= results.length) return null;
    return (
      <TouchableOpacity style={styles.loadMore} onPress={handleLoadMore}>
        <Text style={styles.loadMoreText}>{t(lang, "loadMore")}</Text>
      </TouchableOpacity>
    );
  }, [visibleCount, results.length, lang, handleLoadMore]);

  const ListEmpty = useMemo(() => {
    if (loading) {
      return (
        <ActivityIndicator
          size="large"
          color={colors.pineGreen}
          style={{ marginTop: spacing(6) }}
        />
      );
    }
    if (items.length > 0) {
      return (
        <Text style={styles.emptyText}>{t(lang, "noTrailsYet")}</Text>
      );
    }
    return null;
  }, [loading, items.length, lang]);

  return (
    <View style={styles.root}>
      <Header showMenu />

      <FlatList
        data={visible}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderCard}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: spacing(1) }} />}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
  listContent: {
    paddingHorizontal: spacing(2),
    paddingBottom: spacing(6),
  },
  listHeader: {
    paddingTop: spacing(2),
    paddingBottom: spacing(1),
    gap: spacing(1.5),
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: 10,
    paddingHorizontal: spacing(1.5),
    height: 44,
    gap: spacing(1),
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.black,
    paddingVertical: 0,
  },
  countRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing(1),
  },
  countText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.slateGray,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EDF4ED",
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
    gap: 5,
    flexShrink: 1,
  },
  chipText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.black,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 10,
    overflow: "hidden",
    height: 90,
  },
  cardThumb: {
    width: 90,
    height: 90,
    backgroundColor: colors.cardBg,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  cardBody: {
    flex: 1,
    paddingVertical: spacing(1.2),
    paddingHorizontal: spacing(1.4),
    justifyContent: "center",
    gap: 3,
  },
  cardName: {
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 19,
    color: colors.black,
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  metaText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.slateGray,
  },
  loadMore: {
    alignSelf: "center",
    borderWidth: 1,
    borderColor: colors.pineGreen,
    borderRadius: 8,
    paddingVertical: spacing(1),
    paddingHorizontal: spacing(3),
    marginTop: spacing(2),
  },
  loadMoreText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.pineGreen,
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.slateGray,
    textAlign: "center",
    marginTop: spacing(4),
  },
});
