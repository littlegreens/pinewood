import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Video, ResizeMode } from "expo-av";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, borderRadius } from "../theme";
import { PinewoodLogo } from "../components/SvgIcons";
import AuthPanel from "../components/AuthPanel";

const HERO_VIDEO = require("../../assets/images/hero.mp4");

export default function LandingScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [showAuth, setShowAuth] = useState(false);
  const [authTab, setAuthTab] = useState("login");

  const goHome = () => {
    navigation.reset({ index: 0, routes: [{ name: "Home" }] });
  };

  return (
    <View style={styles.root}>
      <Video
        source={HERO_VIDEO}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping
        isMuted
      />
      <View style={styles.overlay} />

      <View
        style={[
          styles.hero,
          {
            paddingTop: insets.top + 12,
            paddingLeft: Math.max(16, insets.left + 8),
          },
        ]}
      >
        <PinewoodLogo width={220} color="#fff" />
      </View>

      <View style={[styles.actions, { paddingBottom: insets.bottom + 32 }]}>
        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={() => { setAuthTab("login"); setShowAuth(true); }}
          activeOpacity={0.85}
        >
          <Text style={styles.btnPrimaryText}>Login</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnOutline} onPress={goHome} activeOpacity={0.85}>
          <Text style={styles.btnOutlineText}>Entra come ospite</Text>
        </TouchableOpacity>
      </View>

      <AuthPanel
        visible={showAuth}
        onClose={() => setShowAuth(false)}
        onSuccess={goHome}
        initialTab={authTab}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#1b2a1f",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10,18,12,0.45)",
  },
  hero: {
    flex: 1,
    alignItems: "flex-start",
    justifyContent: "flex-start",
  },
  actions: {
    paddingHorizontal: 32,
    gap: 14,
    flexShrink: 0,
  },
  btnPrimary: {
    backgroundColor: colors.white,
    paddingVertical: 14,
    borderRadius: borderRadius.pill,
    alignItems: "center",
  },
  btnPrimaryText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.pineGreen,
  },
  btnOutline: {
    borderWidth: 1.5,
    borderColor: colors.white,
    paddingVertical: 14,
    borderRadius: borderRadius.pill,
    alignItems: "center",
  },
  btnOutlineText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.white,
  },
});
