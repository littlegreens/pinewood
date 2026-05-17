import React, { useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { persistAuthSession } from "../services/api";
import { AUTH_MSG, isEmailNotVerifiedResponse } from "../services/authMessages";
import { colors, fonts, borderRadius } from "../theme";
import { safeBottom } from "../theme/safeArea";

const API_BASE = "https://pinewood.to";

function EyeIcon({ size = 22, color = "#666" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
    </Svg>
  );
}

function EyeOffIcon({ size = 22, color = "#666" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" />
    </Svg>
  );
}

function CheckBox({ checked, onPress, label, required }) {
  return (
    <TouchableOpacity style={stl.checkRow} onPress={onPress} activeOpacity={0.6}>
      <View style={[stl.checkBox, checked && stl.checkBoxOn]}>
        {checked && (
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="#fff">
            <Path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </Svg>
        )}
      </View>
      <Text style={stl.checkLabel}>
        {label}
        {required && <Text style={{ color: colors.error }}> *</Text>}
      </Text>
    </TouchableOpacity>
  );
}

const LEGAL = {
  privacy: {
    title: "Privacy Policy",
    version: "Versione 2026-04-21",
    paragraphs: [
      "Pinewood tratta i dati necessari all\u2019erogazione del servizio: account, sessioni di navigazione, percorsi caricati e preferenze utente. I dati sono trattati per finalit\u00E0 di autenticazione, funzionamento app, sicurezza e miglioramento del servizio.",
      "I file GPX/KML caricati restano sotto la responsabilit\u00E0 dell\u2019utente che li invia: l\u2019utente dichiara di avere i diritti necessari sul contenuto e sulle informazioni presenti nel file. Pinewood non \u00E8 responsabile dei contenuti caricati dagli utenti.",
      "Conservazione: gli account inattivi non vengono cancellati automaticamente e restano presenti finch\u00E9 l\u2019utente non richiede la cancellazione del proprio account. In caso di cancellazione account, i dati personali e i contenuti associati vengono rimossi secondo i tempi tecnici necessari al completamento dell\u2019operazione.",
      "I file caricati possono essere conservati su infrastruttura server gestita dal titolare del trattamento per finalit\u00E0 tecniche di erogazione del servizio, sicurezza e continuit\u00E0 operativa.",
      "L\u2019utente pu\u00F2 richiedere accesso, rettifica o cancellazione dei dati personali scrivendo al titolare del trattamento indicato nella documentazione di progetto.",
    ],
  },
  terms: {
    title: "Termini di Servizio",
    version: "Versione 2026-04-21",
    paragraphs: [
      "L\u2019uso di Pinewood \u00E8 consentito per finalit\u00E0 personali e nel rispetto della normativa locale. L\u2019utente \u00E8 responsabile dei contenuti caricati e dell\u2019uso del servizio durante attivit\u00E0 outdoor.",
      "Pinewood non sostituisce strumenti di sicurezza, mappe ufficiali o valutazioni professionali dei rischi in montagna. L\u2019utente deve verificare condizioni meteo, stato sentieri e idoneit\u00E0 dell\u2019itinerario.",
      "I contenuti caricati (inclusi file GPX/KML) restano sotto la piena responsabilit\u00E0 dell\u2019utente che li pubblica. L\u2019utente garantisce di poterli usare, condividere e caricare sulla piattaforma, e si assume ogni responsabilit\u00E0 per eventuali violazioni di diritti di terzi.",
      "Quando previsto dalle funzionalit\u00E0 del servizio, l\u2019utente pu\u00F2 scaricare i propri contenuti. La disponibilit\u00E0 del download pu\u00F2 dipendere da limiti tecnici o da attivit\u00E0 di manutenzione.",
    ],
  },
};

export default function AuthPanel({ visible, onClose, onSuccess, initialTab = "login" }) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef(null);
  const sheetBottom = safeBottom(insets, 16);

  function scrollFieldIntoView() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }
  const [tab, setTab] = useState(initialTab);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackTone, setFeedbackTone] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState("");

  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [legalModal, setLegalModal] = useState(null);

  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMsg, setForgotMsg] = useState("");
  const [forgotTone, setForgotTone] = useState("");

  function showFeedback(text, tone = "info") {
    setFeedback(text);
    setFeedbackTone(tone);
  }

  const reset = () => {
    setEmail("");
    setPassword("");
    setShowPw(false);
    setName("");
    setFeedback("");
    setFeedbackTone("");
    setVerifyCode("");
    setPendingVerificationEmail("");
    setAcceptPrivacy(false);
    setAcceptTerms(false);
    setMarketingOptIn(false);
    setForgotMode(false);
    setForgotMsg("");
    setForgotTone("");
    setTab(initialTab);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleLogin = async () => {
    const em = email.trim().toLowerCase();
    const pw = password.trim();
    if (!em || !pw) {
      showFeedback("Inserisci email e password", "error");
      return;
    }
    setLoading(true);
    setFeedback("");
    setFeedbackTone("");
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em, password: pw }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (isEmailNotVerifiedResponse(data, res.status)) {
          setPendingVerificationEmail(em);
          setVerifyCode("");
          showFeedback(AUTH_MSG.emailNotVerified, "info");
          return;
        }
        showFeedback(data.error || AUTH_MSG.loginFailed, "error");
        return;
      }
      if (data.accessToken) {
        await persistAuthSession({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          user: data.user,
        });
        reset();
        onSuccess?.();
      }
    } catch (e) {
      showFeedback("Errore di rete. Riprova.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    const em = email.trim().toLowerCase();
    if (!name.trim() || !em || !password) {
      showFeedback("Compila tutti i campi", "error");
      return;
    }
    if (!acceptPrivacy || !acceptTerms) {
      showFeedback("Devi accettare Privacy Policy e Termini di Servizio", "error");
      return;
    }
    setLoading(true);
    setFeedback("");
    setFeedbackTone("");
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: em,
          password,
          acceptPrivacy,
          acceptTerms,
          marketingOptIn,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showFeedback(data.error || "Registrazione non riuscita", "error");
        return;
      }
      if (data.accessToken) {
        await persistAuthSession({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          user: data.user,
        });
        reset();
        onSuccess?.();
      } else {
        setPendingVerificationEmail(em);
        setVerifyCode("");
        setTab("login");
        showFeedback(AUTH_MSG.registerOk, "info");
      }
    } catch (e) {
      showFeedback("Errore di rete. Riprova.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!pendingVerificationEmail || verifyCode.length < 6) return;
    setLoading(true);
    setFeedback("");
    setFeedbackTone("");
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingVerificationEmail, code: verifyCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showFeedback(data.error || AUTH_MSG.verifyFailed, "error");
        return;
      }
      setPendingVerificationEmail("");
      setVerifyCode("");
      showFeedback(AUTH_MSG.verifyOk, "success");
    } catch {
      showFeedback("Errore di rete. Riprova.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!pendingVerificationEmail) return;
    setLoading(true);
    setFeedback("");
    setFeedbackTone("");
    try {
      const res = await fetch(`${API_BASE}/api/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingVerificationEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showFeedback(data.error || AUTH_MSG.resendFailed, "error");
        return;
      }
      showFeedback(AUTH_MSG.resendOk, "success");
    } catch {
      showFeedback("Errore di rete. Riprova.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    const em = forgotEmail.trim().toLowerCase();
    if (!em) return;
    setLoading(true);
    setForgotMsg("");
    setForgotTone("");
    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em }),
      });
      if (res.ok) {
        setForgotMsg(AUTH_MSG.forgotOk);
        setForgotTone("success");
      } else {
        const data = await res.json().catch(() => ({}));
        setForgotMsg(data.error || AUTH_MSG.forgotFailed);
        setForgotTone("error");
      }
    } catch {
      setForgotMsg("Errore di rete. Riprova.");
      setForgotTone("error");
    } finally {
      setLoading(false);
    }
  };

  const feedbackStyle =
    feedbackTone === "error"
      ? styles.feedbackError
      : feedbackTone === "success"
        ? styles.feedbackSuccess
        : styles.feedbackInfo;

  const forgotStyle =
    forgotTone === "error"
      ? styles.feedbackError
      : forgotTone === "success"
        ? styles.feedbackSuccess
        : styles.feedbackInfo;

  const activeLegal = legalModal ? LEGAL[legalModal] : null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <TouchableOpacity
          style={styles.topDismiss}
          activeOpacity={1}
          onPress={handleClose}
        />

        <View style={[styles.sheet, { paddingBottom: sheetBottom }]}>
          <View style={styles.handle} />
          <ScrollView
            ref={scrollRef}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetScroll}
          >
            {forgotMode ? (
              <>
                <Text style={styles.title}>Recupera password</Text>
                <Text style={styles.subtitle}>
                  Inserisci la tua email: ti inviamo un link per creare una nuova password.
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor="#999"
                  value={forgotEmail}
                  onChangeText={setForgotEmail}
                  onFocus={scrollFieldIntoView}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {!!forgotMsg && <Text style={forgotStyle}>{forgotMsg}</Text>}
                <TouchableOpacity
                  style={[styles.btnSubmit, loading && { opacity: 0.6 }]}
                  onPress={handleForgot}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.btnSubmitText}>Invia email</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setForgotMode(false)} style={styles.linkWrap}>
                  <Text style={styles.linkText}>Torna al login</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.tabs}>
                  <TouchableOpacity
                    style={[styles.tab, tab === "login" && styles.tabActive]}
                    onPress={() => { setTab("login"); setFeedback(""); setFeedbackTone(""); }}
                  >
                    <Text style={[styles.tabText, tab === "login" && styles.tabTextActive]}>Login</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tab, tab === "register" && styles.tabActive]}
                    onPress={() => { setTab("register"); setFeedback(""); setFeedbackTone(""); }}
                  >
                    <Text style={[styles.tabText, tab === "register" && styles.tabTextActive]}>Registrati</Text>
                  </TouchableOpacity>
                </View>

                {tab === "register" && (
                  <TextInput
                    style={styles.input}
                    placeholder="Nome"
                    placeholderTextColor="#999"
                    value={name}
                    onChangeText={setName}
                    onFocus={scrollFieldIntoView}
                    autoCapitalize="words"
                  />
                )}

                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor="#999"
                  value={email}
                  onChangeText={setEmail}
                  onFocus={scrollFieldIntoView}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <View style={styles.pwWrap}>
                  <TextInput
                    style={styles.pwInput}
                    placeholder="Password"
                    placeholderTextColor="#999"
                    value={password}
                    onChangeText={setPassword}
                    onFocus={scrollFieldIntoView}
                    secureTextEntry={!showPw}
                  />
                  <TouchableOpacity onPress={() => setShowPw((v) => !v)} style={styles.eyeBtn}>
                    {showPw ? <EyeOffIcon /> : <EyeIcon />}
                  </TouchableOpacity>
                </View>

                {tab === "login" && (
                  <TouchableOpacity
                    onPress={() => { setForgotMode(true); setForgotEmail(email); setForgotMsg(""); }}
                    style={styles.linkWrap}
                  >
                    <Text style={styles.linkText}>Password dimenticata?</Text>
                  </TouchableOpacity>
                )}

                {tab === "register" && (
                  <View style={stl.legalSection}>
                    <CheckBox
                      checked={acceptPrivacy}
                      onPress={() => setAcceptPrivacy((v) => !v)}
                      label="Accetto la Privacy Policy"
                      required
                    />
                    <CheckBox
                      checked={acceptTerms}
                      onPress={() => setAcceptTerms((v) => !v)}
                      label="Accetto i Termini di Servizio"
                      required
                    />
                    <CheckBox
                      checked={marketingOptIn}
                      onPress={() => setMarketingOptIn((v) => !v)}
                      label="Acconsento a comunicazioni opzionali (facoltativo)"
                    />
                    <Text style={stl.legalCaption}>
                      Registrandoti accetti la nostra{" "}
                      <Text style={stl.legalLink} onPress={() => setLegalModal("privacy")}>
                        Privacy Policy
                      </Text>
                      {" "}e i{" "}
                      <Text style={stl.legalLink} onPress={() => setLegalModal("terms")}>
                        Termini di Servizio
                      </Text>
                      .
                    </Text>
                  </View>
                )}

                {pendingVerificationEmail ? (
                  <View style={stl.verifySection}>
                    <Text style={stl.verifyHint}>
                      Codice inviato a {pendingVerificationEmail}. Inserisci le 6 cifre ricevute per email.
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Codice a 6 cifre"
                      placeholderTextColor="#999"
                      value={verifyCode}
                      onChangeText={(v) => setVerifyCode(v.replace(/\D/g, "").slice(0, 6))}
                      onFocus={scrollFieldIntoView}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                    <View style={stl.verifyActions}>
                      <TouchableOpacity
                        style={[stl.verifyBtn, (loading || verifyCode.length < 6) && { opacity: 0.5 }]}
                        onPress={handleVerifyCode}
                        disabled={loading || verifyCode.length < 6}
                      >
                        <Text style={stl.verifyBtnText}>Verifica codice</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={handleResendVerification} disabled={loading}>
                        <Text style={styles.linkText}>Reinvia email</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}

                {!!feedback && <Text style={feedbackStyle}>{feedback}</Text>}

                <TouchableOpacity
                  style={[styles.btnSubmit, loading && { opacity: 0.6 }]}
                  onPress={tab === "login" ? handleLogin : handleRegister}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.btnSubmitText}>
                      {tab === "login" ? "Accedi" : "Registrati"}
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {/* Legal content modal */}
      <Modal visible={!!activeLegal} animationType="slide" transparent>
        <View style={stl.legalOverlay}>
          <View style={[stl.legalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.handle} />
            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
              <Text style={stl.legalTitle}>{activeLegal?.title}</Text>
              <Text style={stl.legalVersion}>{activeLegal?.version}</Text>
              {activeLegal?.paragraphs.map((p, i) => (
                <Text key={i} style={stl.legalParagraph}>{p}</Text>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={stl.legalCloseBtn}
              onPress={() => setLegalModal(null)}
            >
              <Text style={stl.legalCloseBtnText}>Chiudi</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const stl = StyleSheet.create({
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 10,
  },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.divider,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FAFAFA",
  },
  checkBoxOn: {
    backgroundColor: colors.pineGreen,
    borderColor: colors.pineGreen,
  },
  checkLabel: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.black,
    lineHeight: 18,
  },
  legalSection: {
    marginBottom: 10,
    marginTop: 4,
  },
  legalCaption: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.slateGray,
    lineHeight: 17,
    marginTop: 4,
  },
  legalLink: {
    color: colors.pineGreen,
    fontFamily: fonts.semibold,
    textDecorationLine: "underline",
  },
  legalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  legalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 10,
    maxHeight: "85%",
  },
  legalTitle: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.black,
    marginBottom: 4,
  },
  legalVersion: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.slateGray,
    marginBottom: 16,
  },
  legalParagraph: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: "#2f2f2f",
    lineHeight: 21,
    marginBottom: 12,
  },
  legalCloseBtn: {
    backgroundColor: colors.pineGreen,
    paddingVertical: 14,
    borderRadius: borderRadius.pill,
    alignItems: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  legalCloseBtnText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.white,
  },
  verifySection: {
    marginBottom: 8,
    marginTop: 4,
  },
  verifyHint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.slateGray,
    lineHeight: 18,
    marginBottom: 8,
  },
  verifyActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  verifyBtn: {
    borderWidth: 1,
    borderColor: colors.pineGreen,
    borderRadius: borderRadius.sm,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  verifyBtnText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.pineGreen,
  },
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  topDismiss: {
    flex: 1,
  },
  sheetScroll: {
    paddingBottom: 8,
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 10,
    maxHeight: "82%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 24,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D0D0D0",
    alignSelf: "center",
    marginBottom: 14,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.black,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.slateGray,
    marginBottom: 16,
    lineHeight: 20,
  },
  tabs: {
    flexDirection: "row",
    marginBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  tab: {
    flex: 1,
    paddingBottom: 10,
    alignItems: "center",
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.pineGreen,
  },
  tabText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.slateGray,
  },
  tabTextActive: {
    fontFamily: fonts.bold,
    color: colors.pineGreen,
  },
  input: {
    fontFamily: fonts.regular,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    color: colors.black,
    backgroundColor: "#FAFAFA",
  },
  pwWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: borderRadius.sm,
    marginBottom: 12,
    backgroundColor: "#FAFAFA",
  },
  pwInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.black,
  },
  eyeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  linkWrap: {
    alignSelf: "flex-end",
    marginBottom: 10,
  },
  linkText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.pineGreen,
  },
  feedbackError: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.error,
    marginBottom: 10,
    lineHeight: 18,
  },
  feedbackSuccess: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.success,
    marginBottom: 10,
    lineHeight: 18,
  },
  feedbackInfo: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.slateGray,
    marginBottom: 10,
    lineHeight: 18,
  },
  btnSubmit: {
    backgroundColor: colors.pineGreen,
    paddingVertical: 14,
    borderRadius: borderRadius.pill,
    alignItems: "center",
    marginTop: 4,
    marginBottom: 8,
  },
  btnSubmitText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.white,
  },
});
