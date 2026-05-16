import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Alert,
  Animated,
  Pressable,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { SvgXml } from "react-native-svg";
import * as DocumentPicker from "expo-document-picker";
import Header from "../components/Header";
import AppBanner from "../components/AppBanner";
import {
  FilterHdrIcon,
  AccessTimeIcon,
  SignalCellularAltIcon,
  MoreVertIcon,
  CloudUploadIcon,
  AddIcon,
  EditIcon,
  DeleteOutlineIcon,
} from "../components/SvgIcons";
import { apiFetch } from "../services/api";
import { detectLanguage, t } from "../services/i18n";
import { formatMinutesToHours } from "../utils/geo";
import { colors, fonts, spacing, borderRadius } from "../theme";

const TABS = ["mine", "saved"];
const POLL_INTERVAL_MS = 10000;

function prettifyName(fileName) {
  return (fileName || "")
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase()) || "Nuovo percorso";
}

function StatusChip({ status, lang }) {
  if (!status || status === "ready" || status === "ready_no_elevation") return null;
  const label =
    status === "processing" ? t(lang, "processing") :
    status === "processing_elevation" ? t(lang, "processingElevation") :
    status === "error" ? t(lang, "error") : null;
  if (!label) return null;
  const isError = status === "error";
  return (
    <View style={[chipStyles.chip, isError && chipStyles.errorChip]}>
      <Text style={[chipStyles.text, isError && chipStyles.errorText]}>{label}</Text>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    backgroundColor: "#eef1f3",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginLeft: 4,
  },
  text: { fontFamily: fonts.regular, fontSize: 11, color: colors.slateGray },
  errorChip: { backgroundColor: "rgba(211,47,47,0.12)" },
  errorText: { color: colors.error },
});

export default function MyTrailsScreen() {
  const navigation = useNavigation();
  const lang = useMemo(() => detectLanguage(), []);

  const [activeTab, setActiveTab] = useState("mine");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadModal, setUploadModal] = useState(false);
  const [menuTrail, setMenuTrail] = useState(null);
  const [banner, setBanner] = useState({ message: "", type: "success" });
  const menuAnim = useRef(new Animated.Value(0)).current;

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await apiFetch("/api/trails");
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Polling when trails are processing
  useEffect(() => {
    const hasProcessing = items.some(
      (tr) => tr.parse_status === "processing" || tr.parse_status === "processing_elevation",
    );
    if (!hasProcessing) return;
    const id = setInterval(() => fetchAll(true), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [items, fetchAll]);

  const openMenu = useCallback((trail) => {
    setMenuTrail(trail);
    menuAnim.setValue(0);
    Animated.timing(menuAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
  }, [menuAnim]);

  const closeMenu = useCallback(() => {
    Animated.timing(menuAnim, { toValue: 0, duration: 100, useNativeDriver: true }).start(() => setMenuTrail(null));
  }, [menuAnim]);

  const handleUpload = useCallback(async () => {
    setUploadModal(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: Platform.OS === "ios" ? "public.item" : "*/*",
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      const name = asset.name || asset.uri?.split("/").pop() || "track.gpx";
      if (!name.toLowerCase().endsWith(".gpx")) {
        setBanner({ type: "warning", message: t(lang, "onlyGpxAllowed") });
        return;
      }
      setUploading(true);
      const formData = new FormData();
      formData.append("file", {
        uri: asset.uri,
        name,
        type: "application/gpx+xml",
      });
      formData.append("name", prettifyName(name));
      const res = await apiFetch("/api/trails/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        setBanner({ type: "error", message: t(lang, "genericError") });
        return;
      }
      setActiveTab("mine");
      await fetchAll();
      setBanner({ type: "success", message: t(lang, "uploadOk") });
    } catch {
      setBanner({ type: "error", message: t(lang, "genericError") });
    } finally {
      setUploading(false);
    }
  }, [lang, fetchAll]);

  const handleDelete = useCallback(async (trailId) => {
    closeMenu();
    Alert.alert(
      t(lang, "cardMenuDelete"),
      t(lang, "confirmDeleteTrail"),
      [
        { text: t(lang, "cancel"), style: "cancel" },
        {
          text: t(lang, "cardMenuDelete"),
          style: "destructive",
          onPress: async () => {
            const res = await apiFetch(`/api/trails/${trailId}`, { method: "DELETE" });
            if (res.ok) {
              await fetchAll(true);
            } else {
              setBanner({ type: "error", message: t(lang, "genericError") });
            }
          },
        },
      ],
    );
  }, [lang, fetchAll, closeMenu]);

  const handleUnsave = useCallback(async (trailId) => {
    closeMenu();
    const res = await apiFetch(`/api/saved-trails/${trailId}`, { method: "DELETE" });
    if (res.ok) await fetchAll(true);
  }, [fetchAll, closeMenu]);

  const handleEdit = useCallback((trail) => {
    closeMenu();
    setTimeout(() => {
      navigation.navigate("TrailEdit", {
        trailId: trail.id,
        onSaved: () => fetchAll(true),
      });
    }, 150);
  }, [navigation, fetchAll, closeMenu]);

  const displayItems = useMemo(
    () => items.filter((tr) => activeTab === "mine" ? tr.relation_type === "mine" : tr.relation_type === "saved"),
    [items, activeTab],
  );

  const renderCard = useCallback(
    ({ item: trail }) => {
      const km = trail.distance_km != null
        ? `${Number(trail.distance_km).toFixed(1).replace(".", ",")} km`
        : null;
      const time = formatMinutesToHours(trail.estimated_time_minutes);
      const isMine = trail.is_mine || trail.relation_type === "mine";

      return (
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.card}
          onPress={() => navigation.navigate("TrailDetail", { trailId: trail.id })}
        >
          {/* SVG preview thumb */}
          <View style={styles.cardThumb}>
            {trail.svg_preview ? (
              <SvgXml
                xml={trail.svg_preview.replace(
                  /rect[^/]*fill="[^"]*"/g,
                  (m) => m.replace(/fill="[^"]*"/, 'fill="none"'),
                )}
                width={80}
                height={70}
              />
            ) : (
              <FilterHdrIcon size={30} color={colors.pineGreen} />
            )}
          </View>

          <View style={styles.cardBody}>
            <View style={styles.cardNameRow}>
              <Text style={styles.cardName} numberOfLines={2}>{trail.name}</Text>
              <TouchableOpacity
                onPress={(e) => { e.stopPropagation(); openMenu(trail); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.menuBtn}
              >
                <MoreVertIcon size={20} color={colors.slateGray} />
              </TouchableOpacity>
            </View>

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
                  <Text style={styles.metaText} numberOfLines={1}>{trail.difficulty}</Text>
                </View>
              )}
              <StatusChip status={trail.parse_status} lang={lang} />
            </View>

            <Text style={styles.lastHiked}>
              {trail.last_hiked_at
                ? `${t(lang, "lastHikedOn")} ${new Date(trail.last_hiked_at).toLocaleDateString()}`
                : t(lang, "lastHikedNever")}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [navigation, openMenu, lang],
  );

  return (
    <View style={styles.root}>
      <Header />
      <AppBanner
        message={banner.message}
        type={banner.type}
        onDismiss={() => setBanner({ message: "", type: "success" })}
        topOffset={Platform.OS === "ios" ? 96 : 80}
      />

      {/* Tabs */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab;
          const label = tab === "mine" ? t(lang, "myTrailsMine") : t(lang, "myTrailsSaved");
          return (
            <TouchableOpacity
              key={tab}
              activeOpacity={0.7}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Contatore */}
      <Text style={styles.counter}>
        {t(lang, activeTab === "mine" ? "trailsLoadedCount" : "trailsSavedCount")}: {displayItems.length}
      </Text>

      <FlatList
        data={displayItems}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderCard}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: spacing(1) }} />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color={colors.pineGreen} style={{ marginTop: spacing(6) }} />
          ) : (
            <Text style={styles.emptyText}>{t(lang, "noTrailsYet")}</Text>
          )
        }
      />

      {/* FAB + */}
      {activeTab === "mine" && (
        <TouchableOpacity
          style={[styles.fab, uploading && styles.fabDisabled]}
          onPress={() => setUploadModal(true)}
          disabled={uploading}
          activeOpacity={0.85}
        >
          {uploading
            ? <ActivityIndicator size="small" color={colors.white} />
            : <AddIcon size={28} color={colors.white} />
          }
        </TouchableOpacity>
      )}

      {/* Modal info upload */}
      <Modal
        visible={uploadModal}
        transparent
        animationType="slide"
        onRequestClose={() => setUploadModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setUploadModal(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <CloudUploadIcon size={40} color={colors.pineGreen} />
            <Text style={styles.modalTitle}>{t(lang, "uploadInfoTitle")}</Text>
            <Text style={styles.modalBody}>{t(lang, "uploadInfoBody")}</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnOutline} onPress={() => setUploadModal(false)} activeOpacity={0.7}>
                <Text style={styles.btnOutlineText}>{t(lang, "cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={handleUpload} activeOpacity={0.7}>
                <Text style={styles.btnPrimaryText}>{t(lang, "chooseFile")}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Menu trail (•••) */}
      {menuTrail && (
        <Pressable style={styles.menuBackdrop} onPress={closeMenu}>
          <Animated.View
            style={[
              styles.menuSheet,
              { opacity: menuAnim, transform: [{ scale: menuAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }] },
            ]}
          >
            <Text style={styles.menuTrailName} numberOfLines={1}>{menuTrail.name}</Text>
            <View style={styles.menuDivider} />
            {menuTrail.is_mine || menuTrail.relation_type === "mine" ? (
              <>
                <TouchableOpacity style={styles.menuItem} onPress={() => handleEdit(menuTrail)} activeOpacity={0.7}>
                  <EditIcon size={20} color={colors.black} />
                  <Text style={styles.menuItemText}>{t(lang, "cardMenuEdit")}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => handleDelete(menuTrail.id)} activeOpacity={0.7}>
                  <DeleteOutlineIcon size={20} color={colors.error} />
                  <Text style={[styles.menuItemText, { color: colors.error }]}>{t(lang, "cardMenuDelete")}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={styles.menuItem} onPress={() => handleUnsave(menuTrail.id)} activeOpacity={0.7}>
                <DeleteOutlineIcon size={20} color={colors.slateGray} />
                <Text style={styles.menuItemText}>{t(lang, "cardMenuUnsave")}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.menuItem, { marginTop: 4 }]} onPress={closeMenu} activeOpacity={0.7}>
              <Text style={[styles.menuItemText, { color: colors.slateGray }]}>{t(lang, "cancel")}</Text>
            </TouchableOpacity>
          </Animated.View>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },

  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: { borderBottomColor: colors.pineGreen },
  tabLabel: { fontFamily: fonts.bold, fontSize: 14, color: colors.slateGray },
  tabLabelActive: { color: colors.pineGreen },

  counter: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.slateGray,
    paddingHorizontal: spacing(2),
    paddingTop: spacing(1),
    paddingBottom: 2,
  },

  listContent: {
    paddingHorizontal: spacing(2),
    paddingTop: spacing(1),
    paddingBottom: spacing(10),
  },

  card: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 10,
    overflow: "hidden",
    minHeight: 90,
  },
  cardThumb: {
    width: 90,
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
    gap: 4,
  },
  cardNameRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  cardName: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 19,
    color: colors.black,
    marginRight: 4,
  },
  menuBtn: { padding: 2 },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  metaText: { fontFamily: fonts.regular, fontSize: 12, color: colors.slateGray },
  lastHiked: { fontFamily: fonts.regular, fontSize: 11, color: "#aaa", marginTop: 1 },

  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.slateGray,
    textAlign: "center",
    marginTop: spacing(4),
  },

  fab: {
    position: "absolute",
    right: 18,
    bottom: 72,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.pineGreen,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
  },
  fabDisabled: { opacity: 0.6 },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing(3),
    paddingBottom: 40,
    paddingTop: 16,
    alignItems: "center",
    gap: 12,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.divider,
    marginBottom: 8,
  },
  modalTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.black, textAlign: "center" },
  modalBody: { fontFamily: fonts.regular, fontSize: 14, color: colors.slateGray, textAlign: "center", lineHeight: 20 },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 4, width: "100%" },
  btnOutline: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.divider,
    borderRadius: borderRadius.pill,
    paddingVertical: 13,
    alignItems: "center",
  },
  btnOutlineText: { fontFamily: fonts.bold, fontSize: 15, color: colors.black },
  btnPrimary: {
    flex: 1,
    backgroundColor: colors.pineGreen,
    borderRadius: borderRadius.pill,
    paddingVertical: 13,
    alignItems: "center",
  },
  btnPrimaryText: { fontFamily: fonts.bold, fontSize: 15, color: colors.white },

  menuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "flex-end",
  },
  menuSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing(2),
    paddingBottom: 36,
    paddingTop: 16,
  },
  menuTrailName: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.black,
    paddingHorizontal: 8,
    marginBottom: 6,
  },
  menuDivider: { height: 1, backgroundColor: colors.divider, marginBottom: 8 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  menuItemText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.black },
});
