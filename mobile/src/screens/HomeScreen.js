import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
  TextInput,
  useWindowDimensions,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";

import Header from "../components/Header";
import AuthPanel from "../components/AuthPanel";
import AppBanner from "../components/AppBanner";
import {
  HikingIcon,
  ExploreIcon,
  KeyboardArrowDownIcon,
} from "../components/SvgIcons";
import { colors, fonts, borderRadius } from "../theme";
import { safeBottom } from "../theme/safeArea";
import { apiFetch, getStoredAccessToken } from "../services/api";
import { detectLanguage, t } from "../services/i18n";

function ScrollHint({ bottom }) {
  return (
    <View style={[styles.scrollHint, { bottom }]}>
      <KeyboardArrowDownIcon size={28} color="rgba(255,255,255,0.6)" />
    </View>
  );
}

const BASE = "https://pinewood.to";

const IMAGES = {
  hero: { uri: `${BASE}/bg_home_05.webp` },
  chiSiamo: { uri: `${BASE}/bg_home_08.webp` },
  esplora: { uri: `${BASE}/bg_home_07.webp` },
  entra: { uri: `${BASE}/bg_home_04.webp` },
  contatti: { uri: `${BASE}/bg_home_06.webp` },
};

export default function HomeScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const lang = detectLanguage();

  const [isGuest, setIsGuest] = useState(true);

  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactMsg, setContactMsg] = useState("");
  const [contactBusy, setContactBusy] = useState(false);
  const [contactStatus, setContactStatus] = useState("");
  const [showAuth, setShowAuth] = useState(false);
  const [authTab, setAuthTab] = useState("login");

  useEffect(() => {
    (async () => {
      const token = await getStoredAccessToken();
      setIsGuest(!token);
    })();
  }, []);

  async function sendContact() {
    if (!contactName.trim() || !contactEmail.trim() || !contactMsg.trim()) return;
    setContactBusy(true);
    setContactStatus("");
    try {
      const res = await apiFetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: contactName.trim(),
          email: contactEmail.trim(),
          message: contactMsg.trim(),
        }),
        timeoutMs: 30000,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Invio fallito");
      }
      setContactStatus("success");
      setContactName("");
      setContactEmail("");
      setContactMsg("");
    } catch {
      setContactStatus("error");
    } finally {
      setContactBusy(false);
    }
  }

  const headerH = insets.top + 6 + 50 + 1;
  const pageH = winH - headerH - insets.bottom;
  const scrollHintBottom = 20;

  return (
    <View style={styles.root}>
      <Header />
      <ScrollView
        pagingEnabled
        showsVerticalScrollIndicator={false}
        bounces={false}
        decelerationRate="fast"
        snapToInterval={pageH}
        snapToAlignment="start"
      >
        {/* 1 - Hero */}
        <View style={{ height: pageH }}>
          <ImageBackground source={IMAGES.hero} style={styles.bg} resizeMode="cover">
            <View style={styles.overlay} />
            <View style={styles.centered}>
              <Text style={styles.heroTitle}>Keep the way</Text>
              <Text style={styles.heroSub}>
                Pinewood nasce per chi cammina davvero, senza filtri e senza
                rumore, meno distrazioni, pi{"\u00F9"} sentiero.
              </Text>
              <Text style={[styles.heroSub, { marginTop: 20 }]}>
                Pinewood ti accompagna dove serve davvero: fuori, passo dopo
                passo, con testa leggera e sguardo aperto. Keep the way. Sempre.
              </Text>
            </View>
            <ScrollHint bottom={scrollHintBottom} />
          </ImageBackground>
        </View>

        {/* 2 - Chi siamo */}
        <View style={{ height: pageH }}>
          <ImageBackground source={IMAGES.chiSiamo} style={styles.bg} resizeMode="cover">
            <View style={[styles.overlay, { backgroundColor: "rgba(10,18,12,0.55)" }]} />
            <View style={styles.centered}>
              <Text style={styles.sectionBody}>
                Solo sentieri, navigazione GPS e la community di chi condivide i
                propri percorsi. Niente social, niente vanity metrics.
              </Text>
              <Text style={[styles.sectionBody, { marginTop: 18 }]}>
                Carica il tuo GPX, naviga in tempo reale, pocket mode, avvisi
                vocali fuori tracciato e mappe offline. Tutto quello che serve,
                niente di pi{"\u00F9"}.
              </Text>
              <Text style={[styles.sectionBody, { marginTop: 18 }]}>
                Ogni trail caricato diventa parte di una mappa costruita da chi
                cammina, per chi cammina. Keep the way.
              </Text>
            </View>
            <ScrollHint bottom={scrollHintBottom} />
          </ImageBackground>
        </View>

        {/* 3 - Esplora i sentieri */}
        <View style={{ height: pageH }}>
          <ImageBackground source={IMAGES.esplora} style={styles.bg} resizeMode="cover">
            <View style={styles.overlay} />
            <View style={styles.centered}>
              <Text style={styles.sectionTitle}>Esplora i sentieri</Text>
              <Text style={styles.sectionBody}>
                Centinaia di percorsi caricati da chi cammina, pronti da
                esplorare e navigare. Cerca per nome o per luogo, apri la mappa
                e trova il tuo prossimo sentiero.
              </Text>
              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={styles.btnPrimary}
                  onPress={() => navigation.navigate("Trails")}
                  activeOpacity={0.8}
                >
                  <HikingIcon size={20} color={colors.pineGreen} />
                  <Text style={styles.btnPrimaryText}>Trails</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.btnOutline}
                  onPress={() => navigation.navigate("MapDiscover")}
                  activeOpacity={0.8}
                >
                  <ExploreIcon size={20} color={colors.white} />
                  <Text style={styles.btnOutlineText}>Mappa</Text>
                </TouchableOpacity>
              </View>
            </View>
            <ScrollHint bottom={scrollHintBottom} />
          </ImageBackground>
        </View>

        {/* 4 - Entra in Pinewood (solo guest) */}
        {isGuest && (
          <View style={{ height: pageH }}>
            <ImageBackground source={IMAGES.entra} style={styles.bg} resizeMode="cover">
              <View style={[styles.overlay, { backgroundColor: "rgba(10,18,12,0.55)" }]} />
              <View style={styles.centered}>
                <Text style={styles.sectionTitle}>Entra in Pinewood</Text>
                <Text style={styles.sectionBody}>
                  Crea un account gratuito per sbloccare tutto: carica i tuoi
                  percorsi GPX, salva i trail che preferisci, avvia la
                  navigazione GPS in tempo reale.
                </Text>
                <Text style={[styles.sectionBodyBold, { marginTop: 14 }]}>
                  Nessun abbonamento, nessun costo nascosto. Solo sentieri.
                </Text>
                <View style={styles.btnRow}>
                  <TouchableOpacity
                    style={styles.btnPrimary}
                    onPress={() => { setAuthTab("login"); setShowAuth(true); }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.btnPrimaryText}>Login</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.btnOutline}
                    onPress={() => { setAuthTab("register"); setShowAuth(true); }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.btnOutlineText}>Registrati</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <ScrollHint bottom={scrollHintBottom} />
            </ImageBackground>
          </View>
        )}

        {/* 5 - Contattaci */}
        <View style={{ height: pageH }}>
          <ImageBackground source={IMAGES.contatti} style={styles.bg} resizeMode="cover">
            <View style={[styles.overlay, { backgroundColor: "rgba(10,18,12,0.6)" }]} />
            <KeyboardAvoidingView
              style={styles.centered}
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              keyboardVerticalOffset={headerH + 12}
            >
              <ScrollView
                style={{ width: "100%" }}
                contentContainerStyle={styles.contactScroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                <Text style={styles.sectionTitle}>Contattaci</Text>
                <Text style={[styles.sectionBody, { marginBottom: 20 }]}>
                  Hai domande, suggerimenti o vuoi collaborare? Scrivici.
                </Text>

                <TextInput
                  style={styles.input}
                  placeholder="Nome"
                  placeholderTextColor={colors.slateGray}
                  value={contactName}
                  onChangeText={setContactName}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor={colors.slateGray}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={contactEmail}
                  onChangeText={setContactEmail}
                />
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  placeholder="Messaggio"
                  placeholderTextColor={colors.slateGray}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  value={contactMsg}
                  onChangeText={setContactMsg}
                />

                <TouchableOpacity
                  style={[styles.btnPrimary, styles.sendBtn]}
                  onPress={sendContact}
                  disabled={contactBusy}
                  activeOpacity={0.8}
                >
                  {contactBusy ? (
                    <ActivityIndicator size="small" color={colors.pineGreen} />
                  ) : (
                    <Text style={styles.btnPrimaryText}>Invia</Text>
                  )}
                </TouchableOpacity>

              </ScrollView>
            </KeyboardAvoidingView>
          </ImageBackground>
        </View>
      </ScrollView>

      <AuthPanel
        visible={showAuth}
        onClose={() => setShowAuth(false)}
        onSuccess={() => {
          setShowAuth(false);
          setIsGuest(false);
        }}
        initialTab={authTab}
      />

      <AppBanner
        message={
          contactStatus === "success"
            ? t(lang, "contactSentOk")
            : contactStatus === "error"
              ? t(lang, "contactSentError")
              : ""
        }
        type={contactStatus === "error" ? "error" : "success"}
        onDismiss={() => setContactStatus("")}
        durationMs={3000}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#1b2a1f",
  },
  bg: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1b2a1f",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10,18,12,0.45)",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
    zIndex: 1,
    width: "100%",
  },

  heroTitle: {
    fontFamily: fonts.cursive,
    fontSize: 38,
    color: colors.white,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 24,
    marginBottom: 24,
  },
  heroSub: {
    fontFamily: fonts.cursive,
    fontSize: 19,
    lineHeight: 28,
    color: colors.white,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 18,
  },
  scrollHint: {
    position: "absolute",
    bottom: 24,
    alignSelf: "center",
    zIndex: 2,
  },

  sectionTitle: {
    fontFamily: fonts.cursive,
    fontSize: 28,
    color: colors.white,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 16,
    marginBottom: 16,
  },
  sectionBody: {
    fontFamily: fonts.cursive,
    fontSize: 19,
    lineHeight: 27,
    color: "rgba(255,255,255,0.92)",
    textAlign: "center",
  },
  sectionBodyBold: {
    fontFamily: fonts.cursive,
    fontSize: 19,
    lineHeight: 27,
    color: colors.white,
    textAlign: "center",
  },

  btnRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 28,
    gap: 20,
  },
  btnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    paddingVertical: 13,
    paddingHorizontal: 28,
    borderRadius: borderRadius.pill,
    gap: 8,
  },
  btnPrimaryText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.pineGreen,
  },
  btnOutline: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.7)",
    paddingVertical: 13,
    paddingHorizontal: 28,
    borderRadius: borderRadius.pill,
    gap: 8,
  },
  btnOutlineText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.white,
  },

  contactScroll: {
    alignItems: "center",
    paddingVertical: 32,
    width: "100%",
  },
  input: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: fonts.cursive,
    fontSize: 15,
    color: colors.black,
    marginBottom: 12,
  },
  inputMultiline: {
    minHeight: 110,
    paddingTop: 14,
  },
  sendBtn: {
    alignSelf: "flex-end",
    marginTop: 4,
  },
  alertSuccess: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(46,125,50,0.15)",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 14,
    gap: 8,
    width: "100%",
  },
  alertSuccessText: {
    fontFamily: fonts.cursive,
    fontSize: 14,
    color: colors.success,
    flex: 1,
  },
  alertError: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(211,47,47,0.15)",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 14,
    gap: 8,
    width: "100%",
  },
  alertErrorText: {
    fontFamily: fonts.cursive,
    fontSize: 14,
    color: colors.error,
    flex: 1,
  },
});
