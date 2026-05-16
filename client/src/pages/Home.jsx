import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  FormControlLabel,
  Link,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import HikingIcon from "@mui/icons-material/Hiking";
import ExploreIcon from "@mui/icons-material/Explore";
import { useDrag } from "@use-gesture/react";

import { useNavigate } from "react-router-dom";
import { detectLanguage, t } from "../services/i18n.js";
import { AUTH_MSG, authMessageColor, isEmailNotVerifiedResponse } from "../services/authMessages.js";
import InternalHeader from "../components/InternalHeader.jsx";
import AppBanner from "../components/AppBanner.jsx";
import PageContainer from "../components/PageContainer.jsx";
import { pageContainerSx } from "../theme/layout.js";
import { apiFetch } from "../services/api.js";
import { setStoredUserProfile } from "../services/api.js";

const API = import.meta.env.VITE_API_URL || "";

async function readJsonSafe(response) {
  const raw = await response.text();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export default function Home() {
  const navigate = useNavigate();
  const lang = useMemo(() => detectLanguage(), []);
  const [isGuest] = useState(() => !localStorage.getItem("pinewood_access_token"));

  const [showLogin, setShowLogin] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [authMessageTone, setAuthMessageTone] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  function showAuthMessage(text, tone = "info") {
    setAuthMessage(text);
    setAuthMessageTone(tone);
  }
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [legalModal, setLegalModal] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);

  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactStatus, setContactStatus] = useState("");
  const [contactBusy, setContactBusy] = useState(false);

  useEffect(() => {
    if (!contactStatus) return undefined;
    const id = window.setTimeout(() => setContactStatus(""), 3000);
    return () => window.clearTimeout(id);
  }, [contactStatus]);

  const legalContent = useMemo(
    () => ({
      privacy: {
        title: "Privacy Policy",
        version: "Versione 2026-04-21",
        paragraphs: [
          "Pinewood tratta i dati necessari all'erogazione del servizio: account, sessioni di navigazione, percorsi caricati e preferenze utente.",
          "I file GPX caricati restano sotto la responsabilità dell'utente che li invia.",
          "L'utente pu\u00f2 richiedere accesso, rettifica o cancellazione dei dati personali scrivendo al titolare del trattamento.",
        ],
      },
      terms: {
        title: "Termini di Servizio",
        version: "Versione 2026-04-21",
        paragraphs: [
          "L'uso di Pinewood è consentito per finalità personali. L'utente è responsabile dei contenuti caricati.",
          "Pinewood non sostituisce strumenti di sicurezza, mappe ufficiali o valutazioni professionali dei rischi in montagna.",
        ],
      },
      cookies: {
        title: "Cookie Policy",
        version: "Versione 2026-04-21",
        paragraphs: [
          "Pinewood usa cookie tecnici essenziali per autenticazione sessione e sicurezza.",
        ],
      },
    }),
    []
  );
  const activeLegal = legalModal ? legalContent[legalModal] : null;

  async function onLogin(e) {
    e.preventDefault();
    setAuthBusy(true);
    setAuthMessage("");
    setAuthMessageTone("");
    try {
      const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
      const payload = isRegister
        ? { name: authName, email: authEmail, password: authPassword, acceptPrivacy, acceptTerms, marketingOptIn }
        : { email: authEmail, password: authPassword };
      const response = await fetch(`${API}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await readJsonSafe(response);
      if (!response.ok) {
        if (!isRegister && isEmailNotVerifiedResponse(data, response.status)) {
          setIsRegister(false);
          setPendingVerificationEmail(String(authEmail).trim().toLowerCase());
          setVerifyCode("");
          showAuthMessage(AUTH_MSG.emailNotVerified, "info");
          setAuthBusy(false);
          return;
        }
        throw new Error(data.error || t(lang, "loginFailed"));
      }
      if (isRegister) {
        setPendingVerificationEmail(String(authEmail).trim().toLowerCase());
        setVerifyCode("");
        showAuthMessage(AUTH_MSG.registerOk, "info");
        setAuthBusy(false);
        return;
      }
      localStorage.setItem("pinewood_access_token", data.accessToken);
      setStoredUserProfile(data.user);
      setShowLogin(false);
      window.dispatchEvent(new Event("pinewood-user-updated"));
      navigate("/app/trails");
    } catch (error) {
      showAuthMessage(error.message || t(lang, "loginFailed"), "error");
    } finally {
      setAuthBusy(false);
    }
  }

  async function verifyEmailByCode() {
    if (!pendingVerificationEmail || !verifyCode) return;
    setAuthBusy(true);
    setAuthMessage("");
    setAuthMessageTone("");
    try {
      const response = await fetch(`${API}/api/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: pendingVerificationEmail, code: verifyCode }),
      });
      const data = await readJsonSafe(response);
      if (!response.ok) throw new Error(data.error || AUTH_MSG.verifyFailed);
      setPendingVerificationEmail("");
      setVerifyCode("");
      setIsRegister(false);
      showAuthMessage(AUTH_MSG.verifyOk, "success");
    } catch (error) {
      showAuthMessage(error.message || AUTH_MSG.verifyFailed, "error");
    } finally {
      setAuthBusy(false);
    }
  }

  async function resendVerification() {
    if (!pendingVerificationEmail) return;
    setAuthBusy(true);
    setAuthMessage("");
    setAuthMessageTone("");
    try {
      const response = await fetch(`${API}/api/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: pendingVerificationEmail }),
      });
      const data = await readJsonSafe(response);
      if (!response.ok) throw new Error(data.error || AUTH_MSG.resendFailed);
      showAuthMessage(AUTH_MSG.resendOk, "success");
    } catch (error) {
      showAuthMessage(error.message || AUTH_MSG.resendFailed, "error");
    } finally {
      setAuthBusy(false);
    }
  }

  async function onForgotPassword() {
    if (!forgotEmail) return;
    setForgotBusy(true);
    setAuthMessage("");
    setAuthMessageTone("");
    try {
      const response = await fetch(`${API}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await readJsonSafe(response);
      if (!response.ok) throw new Error(data.error || AUTH_MSG.forgotFailed);
      setForgotOpen(false);
      showAuthMessage(AUTH_MSG.forgotOk, "success");
    } catch (error) {
      showAuthMessage(error.message || AUTH_MSG.forgotFailed, "error");
    } finally {
      setForgotBusy(false);
    }
  }

  async function sendContact(e) {
    e.preventDefault();
    if (!contactName.trim() || !contactEmail.trim() || !contactMessage.trim()) return;
    setContactBusy(true);
    setContactStatus("");
    try {
      const res = await fetch(`${API}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: contactName.trim(), email: contactEmail.trim(), message: contactMessage.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Invio fallito");
      }
      setContactStatus("success");
      setContactName("");
      setContactEmail("");
      setContactMessage("");
    } catch (error) {
      console.warn("[contact]", error?.message || error);
      setContactStatus("error");
    } finally {
      setContactBusy(false);
    }
  }

  const containerRef = useRef(null);
  const [current, setCurrent] = useState(0);
  const [containerH, setContainerH] = useState(0);
  const animating = useRef(false);

  const totalSections = isGuest ? 5 : 4;

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) setContainerH(containerRef.current.clientHeight);
    };
    measure();
    window.addEventListener("resize", measure);
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => { window.removeEventListener("resize", measure); ro.disconnect(); };
  }, []);

  const goTo = useCallback((idx) => {
    const clamped = Math.max(0, Math.min(totalSections - 1, idx));
    if (clamped === current || animating.current) return;
    animating.current = true;
    setCurrent(clamped);
    setTimeout(() => { animating.current = false; }, 650);
  }, [current, totalSections]);

  const bind = useDrag(({ swipe: [, sy], direction: [, dy], distance: [, distY], last, memo, first, xy: [, y] }) => {
    if (first) return y;
    if (!last) return memo;
    if (sy !== 0) { goTo(current - sy); }
    else if (distY > 40) { goTo(dy < 0 ? current + 1 : current - 1); }
    return memo;
  }, { axis: "y", filterTaps: true, pointer: { touch: true } });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let lastWheel = 0;
    const onWheel = (e) => {
      e.preventDefault();
      const now = Date.now();
      if (now - lastWheel < 800) return;
      lastWheel = now;
      if (e.deltaY > 30) goTo(current + 1);
      else if (e.deltaY < -30) goTo(current - 1);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [goTo, current]);

  const FONT = '"Shadows Into Light Two", cursive';

  const sectionSx = {
    height: containerH || "100%",
    width: "100%",
          display: "flex",
          flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
    flexShrink: 0,
  };

  const fieldSx = {
    "& .MuiOutlinedInput-root": { bgcolor: "rgba(255,255,255,0.92)", borderRadius: "12px" },
    "& .MuiInputLabel-root": { fontFamily: `${FONT} !important` },
  };

  return (
    <Box sx={{
        bgcolor: "background.default",
      height: "100dvh",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      "& .MuiTypography-root": { fontFamily: `${FONT} !important` },
    }}>
      <InternalHeader />

      <Box
        ref={containerRef}
        {...bind()}
        sx={{
          flex: 1,
          overflow: "hidden",
          position: "relative",
          touchAction: "none",
          userSelect: "none",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            transform: `translateY(-${current * containerH}px)`,
            transition: "transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)",
            willChange: "transform",
          }}
        >
          {/* 1. HERO */}
          <Box sx={{ ...sectionSx, backgroundImage: "url('/bg_home_05.webp')", backgroundSize: "cover", backgroundPosition: "center", backgroundColor: "#1b2a1f" }}>
            <Box sx={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(10,18,12,0.35) 0%, rgba(10,18,12,0.55) 100%)" }} />
            <Box sx={{ position: "relative", zIndex: 1, px: 3, ...pageContainerSx, textAlign: "center" }}>
              <Typography sx={{ color: "#fff", fontSize: { xs: "2.2rem !important", md: "3.2rem !important" }, lineHeight: 1.2, textShadow: "0 6px 32px rgba(0,0,0,0.6)", mb: 3 }}>
          Keep the way
        </Typography>
              <Typography sx={{ color: "#fff", fontSize: "1.2rem !important", lineHeight: 1.7, textShadow: "0 4px 24px rgba(0,0,0,0.5)" }}>
                Pinewood nasce per chi cammina davvero, senza filtri e senza rumore, meno distrazioni, più sentiero.
                <br /><br />
                Pinewood ti accompagna dove serve davvero: fuori, passo dopo passo, con testa leggera e sguardo aperto. Keep the way. Sempre.
              </Typography>
            </Box>
      </Box>

          {/* 2. CHI SIAMO */}
          <Box sx={{ ...sectionSx, backgroundImage: "url('/bg_home_08.webp')", backgroundSize: "cover", backgroundPosition: "center", backgroundColor: "#1b2a1f" }}>
            <Box sx={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(10,18,12,0.4) 0%, rgba(10,18,12,0.6) 100%)" }} />
            <PageContainer sx={{ position: "relative", zIndex: 1 }}>
              <Stack spacing={2.5} sx={{ textAlign: "center", py: { xs: 4, md: 5 } }}>
                <Typography sx={{ color: "rgba(255,255,255,0.92)", fontSize: "1.2rem !important", lineHeight: 1.85 }}>
                  Solo sentieri, navigazione GPS e la community di chi condivide i propri percorsi. Niente social, niente vanity metrics.
                </Typography>
                <Typography sx={{ color: "rgba(255,255,255,0.92)", fontSize: "1.2rem !important", lineHeight: 1.85 }}>
                  Carica il tuo GPX, naviga in tempo reale, pocket mode, avvisi vocali fuori tracciato e mappe offline. Tutto quello che serve, niente di più.
                </Typography>
                <Typography sx={{ color: "rgba(255,255,255,0.92)", fontSize: "1.2rem !important", lineHeight: 1.85 }}>
                  Ogni trail caricato diventa parte di una mappa costruita da chi cammina, per chi cammina. Keep the way.
          </Typography>
              </Stack>
            </PageContainer>
          </Box>

          {/* 3. CTA TRAILS / MAPPA */}
          <Box sx={{ ...sectionSx, backgroundImage: "url('/bg_home_07.webp')", backgroundSize: "cover", backgroundPosition: "center", backgroundColor: "#1b2a1f" }}>
            <Box sx={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(10,18,12,0.3) 0%, rgba(10,18,12,0.6) 100%)" }} />
            <Box sx={{ position: "relative", zIndex: 1, textAlign: "center", px: 3, ...pageContainerSx }}>
              <Typography sx={{ color: "#fff", fontWeight: 800, fontSize: { xs: "1.8rem !important", md: "2.5rem !important" }, textShadow: "0 4px 20px rgba(0,0,0,0.5)", mb: 2 }}>
                Esplora i sentieri
              </Typography>
              <Typography sx={{ color: "rgba(255,255,255,0.88)", fontSize: "1.2rem !important", lineHeight: 1.7, mb: 1.5, textShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>
                Centinaia di percorsi caricati da chi cammina, pronti da esplorare e navigare. Cerca per nome o per luogo, apri la mappa e trova il tuo prossimo sentiero.
              </Typography>
              <Typography sx={{ color: "rgba(255,255,255,0.78)", fontSize: "1.2rem !important", lineHeight: 1.7, mb: 4, textShadow: "0 2px 12px rgba(0,0,0,0.35)" }}>
                Dalla passeggiata nel bosco al trekking in quota, ogni traccia è stata percorsa e condivisa da qualcuno come te. Scegli il percorso, parti con la navigazione GPS e goditi il cammino.
              </Typography>
              <Stack direction="row" spacing={2.5} sx={{ justifyContent: "center", flexWrap: "wrap" }}>
                <Button variant="contained" size="large" startIcon={<HikingIcon />} onClick={() => navigate("/app/trails")} sx={{ px: 4, borderRadius: 99, fontWeight: 700, bgcolor: "#fff", color: "#2D4F1E", "&:hover": { bgcolor: "#f0f0f0" } }}>
                  Trails
                </Button>
                <Button variant="outlined" size="large" startIcon={<ExploreIcon />} onClick={() => navigate("/app/map")} sx={{ px: 4, borderRadius: 99, fontWeight: 700, borderColor: "rgba(255,255,255,0.7)", color: "#fff", borderWidth: 2, "&:hover": { borderColor: "#fff", borderWidth: 2, bgcolor: "rgba(255,255,255,0.08)" } }}>
                  Mappa
                </Button>
              </Stack>
            </Box>
          </Box>

          {/* 4. ISCRIVITI / LOGIN */}
          {isGuest && (
            <Box sx={{ ...sectionSx, backgroundImage: "url('/bg_home_04.webp')", backgroundSize: "cover", backgroundPosition: "center", backgroundColor: "#1b2a1f" }}>
              <Box sx={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(10,18,12,0.4) 0%, rgba(10,18,12,0.6) 100%)" }} />
              <PageContainer sx={{ position: "relative", zIndex: 1 }}>
                <Stack spacing={2.5} sx={{ textAlign: "center", py: { xs: 4, md: 5 } }}>
                  <Typography sx={{ fontWeight: 800, color: "#fff", fontSize: { xs: "1.8rem !important", md: "2.5rem !important" }, textShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
                    Entra in Pinewood
                  </Typography>
                  <Typography sx={{ lineHeight: 1.7, color: "rgba(255,255,255,0.88)", fontSize: "1.2rem !important" }}>
                    Crea un account gratuito per sbloccare tutto: carica i tuoi percorsi GPX, salva i trail che preferisci, avvia la navigazione GPS in tempo reale e tieni traccia delle tue escursioni.
                  </Typography>
                  <Typography sx={{ lineHeight: 1.7, color: "rgba(255,255,255,0.88)", fontSize: "1.2rem !important" }}>
                    Con un account puoi anche ricevere avvisi vocali se esci dal tracciato, usare la pocket mode per camminare senza distrazioni e contribuire alla mappa condivisa caricando le tue tracce.
                  </Typography>
                  <Typography sx={{ lineHeight: 1.7, fontWeight: 600, color: "#fff", fontSize: "1.2rem !important" }}>
                    Nessun abbonamento, nessun costo nascosto. Solo sentieri.
                  </Typography>
                  <Stack direction="row" spacing={1.5} sx={{ justifyContent: "center", pt: 1 }}>
                    <Button variant="contained" size="large" onClick={() => { setIsRegister(false); setShowLogin(true); }} sx={{ px: 4, borderRadius: 99, fontWeight: 700, bgcolor: "#fff", color: "#2D4F1E", "&:hover": { bgcolor: "#f0f0f0" } }}>
                      {t(lang, "login")}
                    </Button>
                    <Button variant="outlined" size="large" onClick={() => { setIsRegister(true); setShowLogin(true); }} sx={{ px: 4, borderRadius: 99, fontWeight: 700, borderColor: "rgba(255,255,255,0.7)", color: "#fff" }}>
                      {t(lang, "register")}
                    </Button>
                  </Stack>
                </Stack>
              </PageContainer>
            </Box>
          )}

          {/* 5. CONTATTACI */}
          <Box sx={{ ...sectionSx, backgroundImage: "url('/bg_home_06.webp')", backgroundSize: "cover", backgroundPosition: "center", backgroundColor: "#1b2a1f" }}>
            <Box sx={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(10,18,12,0.4) 0%, rgba(10,18,12,0.65) 100%)" }} />
            <PageContainer sx={{ py: { xs: 4, md: 5 }, position: "relative", zIndex: 1 }}>
              <Stack spacing={2}>
                <Typography sx={{ fontWeight: 800, color: "#fff", textAlign: "center", fontSize: { xs: "1.8rem !important", md: "2.5rem !important" }, textShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
                  Contattaci
                </Typography>
                <Typography sx={{ textAlign: "center", color: "rgba(255,255,255,0.85)", fontSize: "1.2rem !important" }}>
                  Hai domande, suggerimenti o vuoi collaborare? Scrivici.
                </Typography>
                <Box component="form" onSubmit={sendContact}>
                  <Stack spacing={1.5}>
                    <TextField label="Nome" value={contactName} onChange={(e) => setContactName(e.target.value)} required fullWidth size="small" sx={fieldSx} />
                    <TextField label="Email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} required fullWidth size="small" sx={fieldSx} />
                    <TextField label="Messaggio" value={contactMessage} onChange={(e) => setContactMessage(e.target.value)} required fullWidth multiline minRows={4} size="small" sx={fieldSx} />
                    <Button type="submit" variant="contained" disabled={contactBusy} sx={{ alignSelf: "flex-end", px: 3, borderRadius: 99, fontWeight: 700, bgcolor: "#fff", color: "#2D4F1E", "&:hover": { bgcolor: "#f0f0f0" } }}>
                      {contactBusy ? "Invio..." : "Invia"}
                    </Button>
                  </Stack>
                </Box>
              </Stack>
            </PageContainer>
          </Box>
        </Box>
      </Box>

      {/* LOGIN DRAWER */}
      <Drawer
        anchor="bottom"
        open={showLogin}
        onClose={() => setShowLogin(false)}
        PaperProps={{
          sx: { pb: "max(12px, env(safe-area-inset-bottom))", borderTopLeftRadius: 12, borderTopRightRadius: 12 },
        }}
      >
        <Box sx={{ p: 2.2, bgcolor: "white" }}>
          <Tabs value={isRegister ? 1 : 0} onChange={(_, v) => setIsRegister(v === 1)} sx={{ mb: 1.5 }}>
            <Tab label={t(lang, "login")} />
            <Tab label={t(lang, "register")} />
          </Tabs>
          <Box component="form" onSubmit={onLogin}>
            <Stack spacing={1.2}>
              {isRegister && (
                <TextField label={t(lang, "name")} value={authName} onChange={(e) => setAuthName(e.target.value)} required fullWidth />
              )}
              <TextField label={t(lang, "email")} type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} required fullWidth />
              <TextField label={t(lang, "password")} type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} required fullWidth />
              {!isRegister && (
                <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                  <Button size="small" onClick={() => setForgotOpen(true)}>Recupera password</Button>
                </Box>
              )}
              {isRegister && (
                <>
                  <FormControlLabel
                    control={<Checkbox checked={acceptPrivacy} onChange={(e) => setAcceptPrivacy(e.target.checked)} required />}
                    label="Accetto la Privacy Policy"
                  />
                  <FormControlLabel
                    control={<Checkbox checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} required />}
                    label="Accetto i Termini di Servizio"
                  />
                  <FormControlLabel
                    control={<Checkbox checked={marketingOptIn} onChange={(e) => setMarketingOptIn(e.target.checked)} />}
                    label="Acconsento a comunicazioni opzionali (facoltativo)"
                  />
                  <Typography variant="caption" color="text.secondary">
                    Registrandoti accetti la nostra{" "}
                    <Link component="button" type="button" underline="hover" onClick={() => setLegalModal("privacy")}>Privacy Policy</Link>{" "}
                    e i{" "}
                    <Link component="button" type="button" underline="hover" onClick={() => setLegalModal("terms")}>Termini di Servizio</Link>.
                  </Typography>
                </>
              )}
              {pendingVerificationEmail && (
                <>
                  <Typography variant="caption" color="text.secondary">
                    Codice inviato a <strong>{pendingVerificationEmail}</strong>. Inserisci le 6 cifre ricevute per email.
                  </Typography>
                  <TextField
                    label="Codice a 6 cifre"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputProps={{ inputMode: "numeric", pattern: "[0-9]*", maxLength: 6 }}
                    fullWidth
                  />
                  <Stack direction="row" spacing={1}>
                    <Button variant="outlined" onClick={verifyEmailByCode} disabled={authBusy || verifyCode.length < 6}>
                      Verifica codice
                    </Button>
                    <Button variant="text" onClick={resendVerification} disabled={authBusy}>
                      Reinvia email
                    </Button>
                  </Stack>
                </>
              )}
              <Button type="submit" variant="contained" size="large" disabled={authBusy}>
                {authBusy ? t(lang, "wait") : isRegister ? t(lang, "createAccount") : t(lang, "signIn")}
              </Button>
              {authMessage && (
                <Typography color={authMessageColor(authMessageTone)} variant="body2">
                  {authMessage}
                </Typography>
              )}
            </Stack>
          </Box>
        </Box>
      </Drawer>

      {/* LEGAL DIALOG */}
      <Dialog open={Boolean(activeLegal)} onClose={() => setLegalModal("")} fullWidth maxWidth="md" scroll="paper">
        <DialogTitle>{activeLegal?.title}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.2}>
            <Typography variant="body2" color="text.secondary">{activeLegal?.version}</Typography>
            {(activeLegal?.paragraphs || []).map((p) => (
              <Typography key={p}>{p}</Typography>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setLegalModal("")} variant="contained">Chiudi</Button>
        </DialogActions>
      </Dialog>

      {/* FORGOT PASSWORD */}
      <Dialog open={forgotOpen} onClose={() => setForgotOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Recupero password</DialogTitle>
        <DialogContent>
          <Stack spacing={1.2} sx={{ mt: 0.6 }}>
            <Typography variant="body2" color="text.secondary">
              Inserisci la tua email: ti inviamo un link per creare una nuova password.
          </Typography>
            <TextField label="Email" type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setForgotOpen(false)}>Annulla</Button>
          <Button onClick={onForgotPassword} variant="contained" disabled={forgotBusy || !forgotEmail}>
            {forgotBusy ? "Invio..." : "Invia email"}
            </Button>
        </DialogActions>
      </Dialog>

      <AppBanner
        message={
          contactStatus === "success"
            ? "Messaggio inviato! Ti risponderemo presto."
            : contactStatus === "error"
              ? "Invio fallito, riprova più tardi."
              : ""
        }
        type={contactStatus === "error" ? "error" : "success"}
        onDismiss={() => setContactStatus("")}
        durationMs={3000}
      />
    </Box>
  );
}
