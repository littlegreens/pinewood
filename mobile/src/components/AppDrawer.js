import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Animated,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  FilterHdrIcon,
  HikingIcon,
  ExploreIcon,
  FavoriteBorderIcon,
  AccountCircleIcon,
  LoginIcon,
  LogoutIcon,
  MenuPanelIcon,
  PinewoodLogo,
} from "./SvgIcons";
import AuthPanel from "./AuthPanel";
import { colors, fonts } from "../theme";
import {
  getStoredUserProfile,
  getStoredAccessToken,
  getStoredRefreshToken,
  clearStoredAuth,
  subscribeAuth,
  getApiBase,
} from "../services/api";
import { detectLanguage, t } from "../services/i18n";

const DRAWER_W = 280;

const DrawerContext = createContext({
  open: () => {},
  close: () => {},
  openLogin: () => {},
});

export function useDrawer() {
  return useContext(DrawerContext);
}

function NavItem({ icon, label, active, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.navItem, active && styles.navItemActive]}
      onPress={onPress}
      activeOpacity={0.6}
    >
      <View style={styles.navIcon}>{icon}</View>
      <Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text>
      {active && <View style={styles.activeBar} />}
    </TouchableOpacity>
  );
}

export function DrawerProvider({ children, navRef, currentRoute }) {
  const slideAnim = useRef(new Animated.Value(-DRAWER_W)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  const open = useCallback(() => {
    setVisible(true);
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [slideAnim, fadeAnim]);

  const close = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: -DRAWER_W, duration: 200, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setVisible(false));
  }, [slideAnim, fadeAnim]);

  const openLogin = useCallback(() => {
    close();
    setTimeout(() => setShowAuth(true), 220);
  }, [close]);

  return (
    <DrawerContext.Provider value={{ open, close, openLogin }}>
      {children}
      {visible && (
        <DrawerOverlay
          slideAnim={slideAnim}
          fadeAnim={fadeAnim}
          onClose={close}
          onOpenLogin={openLogin}
          navRef={navRef}
          currentRoute={currentRoute}
        />
      )}
      <AuthPanel
        visible={showAuth}
        onClose={() => setShowAuth(false)}
        onSuccess={() => {
          setShowAuth(false);
          if (navRef?.current) {
            navRef.current.reset({ index: 0, routes: [{ name: "Home" }] });
          }
        }}
        initialTab="login"
      />
    </DrawerContext.Provider>
  );
}

function DrawerOverlay({ slideAnim, fadeAnim, onClose, onOpenLogin, navRef, currentRoute }) {
  const insets = useSafeAreaInsets();
  const lang = detectLanguage();

  const [user, setUser] = useState(null);
  const [isGuest, setIsGuest] = useState(true);

  const refreshDrawerAuth = useCallback(async () => {
    const token = await getStoredAccessToken();
    setIsGuest(!token);
    if (token) {
      const profile = await getStoredUserProfile();
      setUser(profile);
    } else {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refreshDrawerAuth();
    return subscribeAuth(() => refreshDrawerAuth());
  }, [refreshDrawerAuth]);

  const go = useCallback(
    (screen) => {
      onClose();
      setTimeout(() => {
        if (navRef?.current) {
          navRef.current.reset({ index: 0, routes: [{ name: screen }] });
        }
      }, 120);
    },
    [navRef, onClose],
  );

  const handleLogout = useCallback(async () => {
    onClose();
    try {
      const refreshToken = await getStoredRefreshToken();
      await fetch(`${getApiBase()}/api/auth/logout`, {
        method: "DELETE",
        headers: refreshToken ? { "Content-Type": "application/json" } : undefined,
        body: refreshToken ? JSON.stringify({ refreshToken }) : undefined,
      });
    } catch {}
    await clearStoredAuth();
    setTimeout(() => {
      if (navRef?.current) {
        navRef.current.reset({ index: 0, routes: [{ name: "Landing" }] });
      }
    }, 150);
  }, [onClose, navRef]);

  const iconColor = (screen) =>
    currentRoute === screen ? colors.pineGreen : colors.black;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[
          styles.drawer,
          { paddingTop: insets.top + 8, transform: [{ translateX: slideAnim }] },
        ]}
      >
        {/* Header */}
        <View style={styles.drawerHeader}>
          <PinewoodLogo width={130} color={colors.black} />
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <MenuPanelIcon size={24} color={colors.black} />
          </TouchableOpacity>
        </View>
        <View style={styles.divider} />

        {/* Nav Items */}
        <View style={styles.navList}>
          <NavItem
            icon={<FilterHdrIcon size={22} color={iconColor("Home")} />}
            label="Home"
            active={currentRoute === "Home"}
            onPress={() => go("Home")}
          />
          <NavItem
            icon={<HikingIcon size={22} color={iconColor("Trails")} />}
            label="Trails"
            active={currentRoute === "Trails"}
            onPress={() => go("Trails")}
          />
          <NavItem
            icon={<ExploreIcon size={22} color={iconColor("MapDiscover")} />}
            label="Mappa"
            active={currentRoute === "MapDiscover"}
            onPress={() => go("MapDiscover")}
          />
          {!isGuest && (
            <NavItem
              icon={<FavoriteBorderIcon size={22} color={iconColor("MyTrails")} />}
              label={t(lang, "myTrails")}
              active={currentRoute === "MyTrails"}
              onPress={() => go("MyTrails")}
            />
          )}
          {!isGuest && (
            <NavItem
              icon={<AccountCircleIcon size={22} color={iconColor("Profile")} />}
              label="Dashboard"
              active={currentRoute === "Profile"}
              onPress={() => go("Profile")}
            />
          )}
        </View>

        {/* Footer */}
        <View style={styles.divider} />
        {isGuest ? (
          <TouchableOpacity style={styles.footerItem} onPress={onOpenLogin}>
            <LoginIcon size={22} color={colors.slateGray} />
            <Text style={styles.footerLabel}>{t(lang, "login")}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.footerItem} onPress={handleLogout}>
            <LogoutIcon size={22} color={colors.slateGray} />
            <Text style={styles.footerLabel}>{t(lang, "logout")}</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  drawer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: DRAWER_W,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    elevation: 16,
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 10,
  },
  closeBtn: {
    padding: 4,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginBottom: 8,
  },
  navList: {
    flex: 1,
    paddingTop: 4,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 2,
  },
  navItemActive: {
    backgroundColor: "rgba(45,79,30,0.07)",
  },
  navIcon: {
    width: 32,
    alignItems: "center",
  },
  navLabel: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.black,
    marginLeft: 6,
  },
  navLabelActive: {
    color: colors.pineGreen,
  },
  activeBar: {
    width: 4,
    height: 22,
    borderRadius: 99,
    backgroundColor: colors.pineGreen,
    marginLeft: 6,
  },
  footerItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 10,
    marginBottom: 48,
  },
  footerLabel: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.slateGray,
  },
});
