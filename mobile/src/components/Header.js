import React, { useEffect, useState } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import Svg, { Path } from "react-native-svg";
import { MenuPanelIcon, PinewoodLogo, PersonIcon } from "./SvgIcons";
import { useDrawer } from "./AppDrawer";
import OwnerAvatar from "./OwnerAvatar";
import { getStoredAccessToken, getStoredUserProfile, subscribeAuth } from "../services/api";
import { colors } from "../theme";

function ChevronBackIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
    </Svg>
  );
}

export default function Header({ showBack = false }) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const drawer = useDrawer();

  const [user, setUser] = useState(null);
  const [isGuest, setIsGuest] = useState(true);

  async function refreshProfile() {
    const token = await getStoredAccessToken();
    if (!token) {
      setIsGuest(true);
      setUser(null);
      return;
    }
    setIsGuest(false);
    const profile = await getStoredUserProfile();
    setUser(profile);
  }

  useEffect(() => {
    refreshProfile();
    const unsub = subscribeAuth(() => refreshProfile());
    return () => unsub();
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 6 }]}>
      <View style={styles.inner}>
        {showBack ? (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.btn}>
            <ChevronBackIcon size={24} color={colors.black} />
          </TouchableOpacity>
        ) : (
          <View style={styles.leftGroup}>
            <TouchableOpacity onPress={() => drawer.open()} style={styles.btn}>
              <MenuPanelIcon size={24} color={colors.black} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate("Home")} style={styles.logoBtn}>
              <PinewoodLogo width={140} color={colors.black} />
            </TouchableOpacity>
          </View>
        )}

        <View style={{ flex: 1 }} />

        {!showBack && (
          isGuest ? (
            <TouchableOpacity
              onPress={() => drawer.openLogin()}
              style={styles.avatarWrap}
            >
              <View style={[styles.avatar, styles.avatarGuest]}>
                <PersonIcon size={16} color={colors.slateGray} />
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => navigation.navigate("Profile")}
              style={styles.avatarWrap}
            >
              <OwnerAvatar
                avatarUrl={user?.avatar_url}
                name={user?.name}
                size={32}
                style={styles.avatar}
              />
            </TouchableOpacity>
          )
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 56,
    paddingHorizontal: 4,
  },
  btn: {
    width: 40,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  leftGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoBtn: {
    paddingLeft: 4,
    height: 44,
    justifyContent: "center",
    overflow: "visible",
  },
  avatarWrap: {
    paddingHorizontal: 6,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarFallback: {
    backgroundColor: colors.pineGreen,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarGuest: {
    backgroundColor: colors.divider,
    alignItems: "center",
    justifyContent: "center",
  },
});
