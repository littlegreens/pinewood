import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";
import Header from "../components/Header";
import AppBanner from "../components/AppBanner";
import OwnerAvatar from "../components/OwnerAvatar";
import AuthPanel from "../components/AuthPanel";
import { AccountCircleIcon } from "../components/SvgIcons";
import { apiFetch, clearStoredAuth, setStoredUserProfile } from "../services/api";
import { detectLanguage, t } from "../services/i18n";
import { colors, fonts, spacing, borderRadius } from "../theme";

export default function ProfileScreen() {
  const navigation = useNavigation();
  const lang = useMemo(() => detectLanguage(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [hasSession, setHasSession] = useState(true);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarPending, setAvatarPending] = useState(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [stats, setStats] = useState({ trails_uploaded: 0, trails_saved: 0 });
  const [banner, setBanner] = useState({ message: "", type: "success" });

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/users/me");
      if (!res.ok) {
        setHasSession(false);
        return;
      }
      const data = await res.json();
      setHasSession(true);
      setName(data.name || "");
      setEmail(data.email || "");
      setAvatarUrl(data.avatar_url || "");
      setAvatarPending(null);
      setStats({
        trails_uploaded: data.trails_uploaded ?? 0,
        trails_saved: data.trails_saved ?? 0,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handlePickAvatar = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setBanner({
        type: "warning",
        message: t(lang, "galleryPermissionDenied"),
      });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return;
    setAvatarPending(result.assets[0].uri);
  }, [lang]);

  const saveProfile = useCallback(async () => {
    const shouldChangePassword = Boolean(currentPassword && newPassword);
    if ((currentPassword && !newPassword) || (!currentPassword && newPassword)) {
      setBanner({ type: "warning", message: t(lang, "profilePasswordBoth") });
      return;
    }

    setSaving(true);
    try {
      if (shouldChangePassword) {
        if (newPassword.trim().length < 8) {
          setBanner({ type: "warning", message: t(lang, "profilePasswordTooShort") });
          return;
        }
        const pwdRes = await apiFetch("/api/users/me/password", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentPassword: currentPassword.trim(),
            newPassword: newPassword.trim(),
          }),
        });
        if (!pwdRes.ok) {
          const data = await pwdRes.json().catch(() => ({}));
          setBanner({ type: "error", message: data.error || t(lang, "profilePasswordError") });
          return;
        }
        setCurrentPassword("");
        setNewPassword("");
      }

      const form = new FormData();
      form.append("name", name.trim());
      if (avatarPending) {
        form.append("avatar", {
          uri: avatarPending,
          name: "avatar.jpg",
          type: "image/jpeg",
        });
      }
      const res = await apiFetch("/api/users/me", { method: "PATCH", body: form });
      if (!res.ok) {
        setBanner({ type: "error", message: t(lang, "profileSaveError") });
        return;
      }
      const user = await res.json();
      await setStoredUserProfile(user);
      setName(user.name || "");
      setEmail(user.email || "");
      setAvatarUrl(user.avatar_url || "");
      setAvatarPending(null);
      setStats({
        trails_uploaded: user.trails_uploaded ?? 0,
        trails_saved: user.trails_saved ?? 0,
      });
      setBanner({
        type: "success",
        message: shouldChangePassword ? t(lang, "profileUpdatedWithPassword") : t(lang, "profileUpdated"),
      });
    } finally {
      setSaving(false);
    }
  }, [name, currentPassword, newPassword, avatarPending, lang]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(t(lang, "deleteAccountTitle"), t(lang, "deleteAccountBody"), [
      { text: t(lang, "cancel"), style: "cancel" },
      {
        text: t(lang, "deleteAccountConfirm"),
        style: "destructive",
        onPress: async () => {
          try {
            const res = await apiFetch("/api/users/me", { method: "DELETE" });
            if (res.ok || res.status === 204) {
              await clearStoredAuth("account_deleted");
              navigation.reset({ index: 0, routes: [{ name: "Landing" }] });
            } else {
              setBanner({ type: "error", message: t(lang, "profileDeleteError") });
            }
          } catch {
            setBanner({ type: "error", message: t(lang, "genericError") });
          }
        },
      },
    ]);
  }, [lang, navigation]);

  const avatarDisplayUrl = avatarPending || avatarUrl || null;

  if (loading) {
    return (
      <View style={styles.root}>
        <Header showMenu />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.pineGreen} />
        </View>
      </View>
    );
  }

  if (!hasSession) {
    return (
      <View style={styles.root}>
        <Header showMenu />
        <View style={styles.center}>
          <AccountCircleIcon size={48} color={colors.slateGray} />
          <Text style={styles.noUserText}>{t(lang, "sessionExpired")}</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setShowAuth(true)} activeOpacity={0.8}>
            <Text style={styles.primaryBtnText}>{t(lang, "login")}</Text>
          </TouchableOpacity>
        </View>
        <AuthPanel
          visible={showAuth}
          onClose={() => setShowAuth(false)}
          onSuccess={() => {
            setShowAuth(false);
            loadProfile();
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Header showMenu />
      <AppBanner
        message={banner.message}
        type={banner.type}
        onDismiss={() => setBanner({ message: "", type: "success" })}
        topOffset={Platform.OS === "ios" ? 96 : 80}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statCaption}>{t(lang, "profileStatUploaded")}</Text>
              <Text style={styles.statValue}>{stats.trails_uploaded}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statCaption}>{t(lang, "profileStatSaved")}</Text>
              <Text style={styles.statValue}>{stats.trails_saved}</Text>
            </View>
          </View>

          <View style={styles.avatarRow}>
            <OwnerAvatar
              avatarUrl={avatarDisplayUrl}
              name={name}
              size={56}
              style={styles.avatar}
            />
            <TouchableOpacity
              style={styles.outlineBtn}
              onPress={handlePickAvatar}
              activeOpacity={0.7}
            >
              <Text style={styles.outlineBtnText}>{t(lang, "uploadAvatar")}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.fieldLabel}>{t(lang, "displayName")}</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={t(lang, "displayName")}
            placeholderTextColor={colors.slateGray}
            autoCapitalize="words"
          />

          <Text style={styles.fieldLabel}>{t(lang, "email")}</Text>
          <TextInput
            style={[styles.input, styles.inputDisabled]}
            value={email}
            editable={false}
            selectTextOnFocus={false}
          />

          <Text style={styles.fieldLabel}>{t(lang, "currentPassword")}</Text>
          <TextInput
            style={styles.input}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            placeholder={t(lang, "currentPassword")}
            placeholderTextColor={colors.slateGray}
            autoCapitalize="none"
          />

          <Text style={styles.fieldLabel}>{t(lang, "newPassword")}</Text>
          <TextInput
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            placeholder={t(lang, "newPassword")}
            placeholderTextColor={colors.slateGray}
            autoCapitalize="none"
          />

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={handleDeleteAccount}
              activeOpacity={0.7}
            >
              <Text style={styles.deleteBtnText}>{t(lang, "deleteAccount")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryBtn, styles.saveBtn]}
              onPress={saveProfile}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.primaryBtnText}>{t(lang, "saveChanges")}</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing(4),
    gap: spacing(2),
  },
  scrollContent: {
    paddingHorizontal: spacing(3),
    paddingTop: spacing(3),
    paddingBottom: spacing(8),
    gap: spacing(1.5),
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing(1),
    marginBottom: spacing(1),
  },
  statBox: {
    flex: 1,
    backgroundColor: "#f4f8f2",
    borderRadius: borderRadius.md,
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(1.5),
  },
  statCaption: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.slateGray,
    marginBottom: 4,
  },
  statValue: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.black,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
    marginTop: spacing(0.5),
    marginBottom: spacing(1),
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  outlineBtn: {
    borderWidth: 1,
    borderColor: colors.pineGreen,
    borderRadius: borderRadius.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing(2),
  },
  outlineBtnText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.pineGreen,
  },
  fieldLabel: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.slateGray,
    marginTop: spacing(0.5),
    marginBottom: 4,
  },
  input: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.black,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: borderRadius.sm,
    paddingVertical: 12,
    paddingHorizontal: spacing(2),
    backgroundColor: colors.white,
    marginBottom: spacing(0.5),
  },
  inputDisabled: {
    backgroundColor: "#f5f5f5",
    color: colors.slateGray,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing(1.5),
    marginTop: spacing(3),
  },
  deleteBtn: {
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: borderRadius.sm,
    paddingVertical: 12,
    paddingHorizontal: spacing(2),
    flexShrink: 1,
  },
  deleteBtnText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.error,
  },
  primaryBtn: {
    backgroundColor: colors.pineGreen,
    borderRadius: borderRadius.sm,
    paddingVertical: 12,
    paddingHorizontal: spacing(3),
    alignItems: "center",
    justifyContent: "center",
    minWidth: 140,
  },
  saveBtn: {
    flex: 1,
    maxWidth: 200,
  },
  primaryBtnText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.white,
  },
  noUserText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.slateGray,
    textAlign: "center",
  },
});
