import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Switch,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import {
  EditIcon,
  DeleteOutlineIcon,
  AddIcon,
  ParkingIcon,
} from "../components/SvgIcons";
import { apiFetch } from "../services/api";
import { detectLanguage, t } from "../services/i18n";
import { colors, fonts, spacing, borderRadius } from "../theme";

function stripHtml(html) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function ChevronBackIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
    </Svg>
  );
}

const EMPTY_EDIT = {
  id: "",
  source: "",
  name: "",
  description: "",
  route_type: "",
  difficulty: "",
  start_location_text: "",
  start_location_lat: "",
  start_location_lon: "",
  distance_km: "",
  elevation_gain_m: "",
  elevation_loss_m: "",
  max_elevation_m: "",
  min_elevation_m: "",
  source_website_url: "",
  is_public: true,
  parkings: [],
};

const EMPTY_PARKING = { label: "", lat: "", lon: "", notes: "" };

export default function TrailEditScreen({ route, navigation }) {
  const { trailId, onSaved } = route.params ?? {};
  const insets = useSafeAreaInsets();
  const lang = useMemo(() => detectLanguage(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState(EMPTY_EDIT);

  const [parkingForm, setParkingForm] = useState(EMPTY_PARKING);
  const [editingParkingId, setEditingParkingId] = useState(null);
  const [savingParking, setSavingParking] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`/api/trails/${trailId}`);
        if (!res.ok || !active) return;
        const trail = await res.json();
        if (active) {
          setData({
            id: trail.id,
            source: trail.source || "",
            name: trail.name || "",
            description: stripHtml(trail.description || ""),
            route_type: trail.route_type || "",
            difficulty: trail.difficulty || "",
            start_location_text: trail.start_location_text || "",
            start_location_lat: trail.start_location_lat != null ? String(trail.start_location_lat) : "",
            start_location_lon: trail.start_location_lon != null ? String(trail.start_location_lon) : "",
            distance_km: trail.distance_km != null ? String(trail.distance_km) : "",
            elevation_gain_m: trail.elevation_gain_m != null ? String(trail.elevation_gain_m) : "",
            elevation_loss_m: trail.elevation_loss_m != null ? String(trail.elevation_loss_m) : "",
            max_elevation_m: trail.max_elevation_m != null ? String(trail.max_elevation_m) : "",
            min_elevation_m: trail.min_elevation_m != null ? String(trail.min_elevation_m) : "",
            source_website_url: trail.source_website_url || "",
            is_public: trail.is_public ?? true,
            parkings: Array.isArray(trail.parkings) ? trail.parkings : [],
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [trailId]);

  const set = useCallback((key, value) => {
    setData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const save = useCallback(async () => {
    if (!data.name.trim() && data.source !== "osm") {
      Alert.alert("", t(lang, "name") + " è obbligatorio");
      return;
    }
    setSaving(true);
    try {
      const payload = data.source === "osm"
        ? {
            start_location_text: data.start_location_text || null,
            start_location_lat: data.start_location_lat === "" ? null : Number(data.start_location_lat),
            start_location_lon: data.start_location_lon === "" ? null : Number(data.start_location_lon),
            is_public: data.is_public,
          }
        : {
            name: data.name,
            description: data.description || null,
            route_type: data.route_type || null,
            difficulty: data.difficulty || null,
            start_location_text: data.start_location_text || null,
            start_location_lat: data.start_location_lat === "" ? null : Number(data.start_location_lat),
            start_location_lon: data.start_location_lon === "" ? null : Number(data.start_location_lon),
            distance_km: data.distance_km === "" ? null : Number(data.distance_km),
            elevation_gain_m: data.elevation_gain_m === "" ? null : Number(data.elevation_gain_m),
            elevation_loss_m: data.elevation_loss_m === "" ? null : Number(data.elevation_loss_m),
            max_elevation_m: data.max_elevation_m === "" ? null : Number(data.max_elevation_m),
            min_elevation_m: data.min_elevation_m === "" ? null : Number(data.min_elevation_m),
            source_website_url: data.source_website_url.trim() || null,
            is_public: data.is_public,
          };
      const res = await apiFetch(`/api/trails/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        Alert.alert("", t(lang, "genericError"));
        return;
      }
      onSaved?.();
      navigation.goBack();
    } catch {
      Alert.alert("", t(lang, "genericError"));
    } finally {
      setSaving(false);
    }
  }, [data, lang, navigation, onSaved]);

  const reloadParkings = useCallback(async () => {
    const res = await apiFetch(`/api/trails/${data.id}`);
    if (res.ok) {
      const trail = await res.json();
      setData((prev) => ({ ...prev, parkings: Array.isArray(trail.parkings) ? trail.parkings : [] }));
    }
  }, [data.id]);

  const submitParking = useCallback(async () => {
    if (!parkingForm.label.trim()) return;
    setSavingParking(true);
    try {
      const url = editingParkingId
        ? `/api/parkings/${editingParkingId}`
        : `/api/trails/${data.id}/parkings`;
      const method = editingParkingId ? "PATCH" : "POST";
      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: parkingForm.label,
          notes: parkingForm.notes || null,
          lat: parkingForm.lat === "" ? null : Number(parkingForm.lat),
          lon: parkingForm.lon === "" ? null : Number(parkingForm.lon),
        }),
      });
      if (!res.ok) return;
      await reloadParkings();
      setParkingForm(EMPTY_PARKING);
      setEditingParkingId(null);
    } finally {
      setSavingParking(false);
    }
  }, [parkingForm, editingParkingId, data.id, reloadParkings]);

  const deleteParking = useCallback(async (parkingId) => {
    const res = await apiFetch(`/api/parkings/${parkingId}`, { method: "DELETE" });
    if (res.ok) {
      setData((prev) => ({ ...prev, parkings: prev.parkings.filter((p) => p.id !== parkingId) }));
    }
  }, []);

  const startEditParking = useCallback((parking) => {
    setEditingParkingId(parking.id);
    setParkingForm({
      label: parking.label || "",
      lat: parking.lat != null ? String(parking.lat) : "",
      lon: parking.lon != null ? String(parking.lon) : "",
      notes: parking.notes || "",
    });
  }, []);

  if (loading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <ChevronBackIcon size={24} color={colors.black} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t(lang, "editTrail")}</Text>
          <View style={styles.headerBtn} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.pineGreen} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ChevronBackIcon size={24} color={colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{t(lang, "editTrail")}</Text>
        <TouchableOpacity
          onPress={save}
          style={[styles.headerBtn, styles.saveBtn]}
          disabled={saving}
          activeOpacity={0.7}
        >
          {saving
            ? <ActivityIndicator size="small" color={colors.white} />
            : <Text style={styles.saveBtnText}>{t(lang, "save")}</Text>
          }
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={insets.top + 56}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Pubblico switch */}
          <View style={styles.rowBetween}>
            <Text style={styles.label}>{t(lang, "isPublic")}</Text>
            <Switch
              value={data.is_public}
              onValueChange={(v) => set("is_public", v)}
              trackColor={{ true: colors.pineGreen }}
              thumbColor={colors.white}
            />
          </View>
          <View style={styles.divider} />

          {/* Campi solo per trail non-OSM */}
          {data.source !== "osm" && (
            <>
              <Text style={styles.sectionTitle}>Info</Text>
              <Field label={t(lang, "name")} value={data.name} onChangeText={(v) => set("name", v)} />
              <Field
                label={t(lang, "descriptionPlain")}
                value={data.description}
                onChangeText={(v) => set("description", v)}
                multiline
                numberOfLines={4}
              />
              <Field label={t(lang, "officialWebsite")} value={data.source_website_url} onChangeText={(v) => set("source_website_url", v)} keyboardType="url" />
              <Field label={t(lang, "difficulty")} value={data.difficulty} onChangeText={(v) => set("difficulty", v)} />
              <Field label={t(lang, "routeType")} value={data.route_type} onChangeText={(v) => set("route_type", v)} />

              <Text style={[styles.sectionTitle, { marginTop: spacing(2) }]}>Misure</Text>
              <View style={styles.row2}>
                <Field label={t(lang, "distanceKm")} value={data.distance_km} onChangeText={(v) => set("distance_km", v)} keyboardType="decimal-pad" flex />
                <View style={{ width: 10 }} />
                <Field label={t(lang, "elevGain")} value={data.elevation_gain_m} onChangeText={(v) => set("elevation_gain_m", v)} keyboardType="decimal-pad" flex />
              </View>
              <View style={styles.row2}>
                <Field label={t(lang, "elevLoss")} value={data.elevation_loss_m} onChangeText={(v) => set("elevation_loss_m", v)} keyboardType="decimal-pad" flex />
                <View style={{ width: 10 }} />
                <Field label={t(lang, "elevMax")} value={data.max_elevation_m} onChangeText={(v) => set("max_elevation_m", v)} keyboardType="decimal-pad" flex />
              </View>
              <Field label={t(lang, "elevMin")} value={data.min_elevation_m} onChangeText={(v) => set("min_elevation_m", v)} keyboardType="decimal-pad" />
            </>
          )}

          {/* Partenza */}
          <Text style={[styles.sectionTitle, { marginTop: spacing(2) }]}>Partenza</Text>
          <Field label={t(lang, "startLocationText")} value={data.start_location_text} onChangeText={(v) => set("start_location_text", v)} />
          <View style={styles.row2}>
            <Field label={t(lang, "startLocationLat")} value={data.start_location_lat} onChangeText={(v) => set("start_location_lat", v)} keyboardType="decimal-pad" flex />
            <View style={{ width: 10 }} />
            <Field label={t(lang, "startLocationLon")} value={data.start_location_lon} onChangeText={(v) => set("start_location_lon", v)} keyboardType="decimal-pad" flex />
          </View>

          {/* Parcheggi */}
          <View style={styles.sectionHeader}>
            <ParkingIcon size={18} color={colors.pineGreen} />
            <Text style={styles.sectionTitle}>{t(lang, "parkings")}</Text>
          </View>

          {data.parkings.length === 0 && (
            <Text style={styles.emptyText}>{t(lang, "noParkings")}</Text>
          )}
          {data.parkings.map((p) => (
            <View key={p.id} style={styles.parkingCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.parkingLabel}>{p.label}</Text>
                {(p.lat != null || p.lon != null) && (
                  <Text style={styles.parkingMeta}>{p.lat}, {p.lon}</Text>
                )}
                {p.notes ? <Text style={styles.parkingMeta}>{p.notes}</Text> : null}
              </View>
              <TouchableOpacity onPress={() => startEditParking(p)} style={styles.iconBtn}>
                <EditIcon size={18} color={colors.slateGray} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteParking(p.id)} style={styles.iconBtn}>
                <DeleteOutlineIcon size={18} color={colors.error} />
              </TouchableOpacity>
            </View>
          ))}

          {/* Form aggiunta / modifica parcheggio */}
          <View style={styles.parkingForm}>
            <Field label={t(lang, "parkingLabel")} value={parkingForm.label} onChangeText={(v) => setParkingForm((f) => ({ ...f, label: v }))} />
            <View style={styles.row2}>
              <Field label={t(lang, "parkingLat")} value={parkingForm.lat} onChangeText={(v) => setParkingForm((f) => ({ ...f, lat: v }))} keyboardType="decimal-pad" flex />
              <View style={{ width: 10 }} />
              <Field label={t(lang, "parkingLon")} value={parkingForm.lon} onChangeText={(v) => setParkingForm((f) => ({ ...f, lon: v }))} keyboardType="decimal-pad" flex />
            </View>
            <Field label={t(lang, "parkingNotes")} value={parkingForm.notes} onChangeText={(v) => setParkingForm((f) => ({ ...f, notes: v }))} />
            <TouchableOpacity
              style={[styles.addParkingBtn, !parkingForm.label.trim() && styles.disabledBtn]}
              onPress={submitParking}
              disabled={!parkingForm.label.trim() || savingParking}
              activeOpacity={0.7}
            >
              {savingParking
                ? <ActivityIndicator size="small" color={colors.pineGreen} />
                : (
                  <>
                    <AddIcon size={18} color={colors.pineGreen} />
                    <Text style={styles.addParkingText}>
                      {editingParkingId ? t(lang, "save") : t(lang, "addParking")}
                    </Text>
                  </>
                )
              }
            </TouchableOpacity>
            {editingParkingId && (
              <TouchableOpacity
                style={styles.cancelParkingBtn}
                onPress={() => { setEditingParkingId(null); setParkingForm(EMPTY_PARKING); }}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelParkingText}>{t(lang, "cancel")}</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({ label, value, onChangeText, multiline, numberOfLines, keyboardType, flex }) {
  return (
    <View style={[fieldStyles.wrap, flex && { flex: 1 }]}>
      <Text style={fieldStyles.label}>{label}</Text>
      <TextInput
        style={[fieldStyles.input, multiline && fieldStyles.multiline]}
        value={String(value ?? "")}
        onChangeText={onChangeText}
        multiline={multiline}
        numberOfLines={numberOfLines}
        keyboardType={keyboardType || "default"}
        autoCapitalize="sentences"
        textAlignVertical={multiline ? "top" : "center"}
        placeholderTextColor={colors.slateGray}
      />
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrap: { marginBottom: spacing(1.2) },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.slateGray,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.black,
    backgroundColor: colors.white,
    minHeight: 42,
  },
  multiline: {
    minHeight: 90,
    paddingTop: 10,
  },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    paddingHorizontal: 4,
  },
  headerBtn: {
    width: 60,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.black,
    textAlign: "center",
  },
  saveBtn: {
    backgroundColor: colors.pineGreen,
    borderRadius: borderRadius.sm,
    width: 70,
    height: 36,
    marginRight: 8,
  },
  saveBtnText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.white,
  },
  scroll: {
    paddingHorizontal: spacing(2),
    paddingTop: spacing(2),
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: spacing(1.5),
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
    marginTop: spacing(2),
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.black,
    marginBottom: spacing(1),
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.black,
  },
  row2: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.slateGray,
    marginBottom: spacing(1),
  },
  parkingCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: borderRadius.sm,
    padding: 10,
    marginBottom: 8,
    backgroundColor: "#f9f9f9",
  },
  parkingLabel: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.black,
  },
  parkingMeta: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.slateGray,
    marginTop: 1,
  },
  iconBtn: {
    padding: 6,
  },
  parkingForm: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: spacing(1.5),
    marginTop: spacing(1),
  },
  addParkingBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.pineGreen,
    borderRadius: borderRadius.sm,
    paddingVertical: 10,
    paddingHorizontal: 16,
    justifyContent: "center",
    gap: 6,
    marginBottom: 8,
  },
  addParkingText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.pineGreen,
  },
  cancelParkingBtn: {
    alignItems: "center",
    paddingVertical: 8,
  },
  cancelParkingText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.slateGray,
  },
  disabledBtn: {
    opacity: 0.4,
  },
});
