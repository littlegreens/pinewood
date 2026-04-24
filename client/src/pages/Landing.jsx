import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
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
import { useLocation, useNavigate } from "react-router-dom";
import { detectLanguage, t } from "../services/i18n.js";
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

export default function Landing() {
  const navigate = useNavigate();
  const location = useLocation();
  const lang = useMemo(() => detectLanguage(), []);
  const [showLogin, setShowLogin] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [legalModal, setLegalModal] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem("pinewood_access_token") || "");
  const isLogged = useMemo(() => Boolean(accessToken), [accessToken]);

  const legalContent = useMemo(
    () => ({
      privacy: {
        title: "Privacy Policy",
        version: "Versione 2026-04-21",
        paragraphs: [
          "Pinewood tratta i dati necessari all’erogazione del servizio: account, sessioni di navigazione, percorsi caricati e preferenze utente. I dati sono trattati per finalità di autenticazione, funzionamento app, sicurezza e miglioramento del servizio.",
          "I file GPX/KML caricati restano sotto la responsabilità dell’utente che li invia: l’utente dichiara di avere i diritti necessari sul contenuto e sulle informazioni presenti nel file. Pinewood non è responsabile dei contenuti caricati dagli utenti.",
          "Conservazione: gli account inattivi non vengono cancellati automaticamente e restano presenti finché l’utente non richiede la cancellazione del proprio account. In caso di cancellazione account, i dati personali e i contenuti associati vengono rimossi secondo i tempi tecnici necessari al completamento dell’operazione.",
          "I file caricati possono essere conservati su infrastruttura server gestita dal titolare del trattamento per finalità tecniche di erogazione del servizio, sicurezza e continuità operativa.",
          "L’utente può richiedere accesso, rettifica o cancellazione dei dati personali scrivendo al titolare del trattamento indicato nella documentazione di progetto.",
        ],
      },
      terms: {
        title: "Termini di Servizio",
        version: "Versione 2026-04-21",
        paragraphs: [
          "L’uso di Pinewood è consentito per finalità personali e nel rispetto della normativa locale. L’utente è responsabile dei contenuti caricati e dell’uso del servizio durante attività outdoor.",
          "Pinewood non sostituisce strumenti di sicurezza, mappe ufficiali o valutazioni professionali dei rischi in montagna. L’utente deve verificare condizioni meteo, stato sentieri e idoneità dell’itinerario.",
          "I contenuti caricati (inclusi file GPX/KML) restano sotto la piena responsabilità dell’utente che li pubblica. L’utente garantisce di poterli usare, condividere e caricare sulla piattaforma, e si assume ogni responsabilità per eventuali violazioni di diritti di terzi.",
          "Quando previsto dalle funzionalità del servizio, l’utente può scaricare i propri contenuti. La disponibilità del download può dipendere da limiti tecnici o da attività di manutenzione.",
        ],
      },
      cookies: {
        title: "Cookie Policy",
        version: "Versione 2026-04-21",
        paragraphs: [
          "Pinewood usa cookie tecnici essenziali per autenticazione sessione (refresh token) e sicurezza. In ambiente di test non vengono usati cookie di profilazione di terze parti.",
          "Le preferenze locali possono essere salvate nel browser (es. lingua, stato utente) tramite storage locale per migliorare l’esperienza d’uso.",
        ],
      },
    }),
    []
  );
  const activeLegal = legalModal ? legalContent[legalModal] : null;

  useEffect(() => {
    function syncAuthState() {
      setAccessToken(localStorage.getItem("pinewood_access_token") || "");
    }
    window.addEventListener("storage", syncAuthState);
    window.addEventListener("pinewood-user-updated", syncAuthState);
    return () => {
      window.removeEventListener("storage", syncAuthState);
      window.removeEventListener("pinewood-user-updated", syncAuthState);
    };
  }, []);

  useEffect(() => {
    if (location.state?.openLogin) {
      setShowLogin(true);
    }
  }, [location.state]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const verifyToken = params.get("verify");
    const pwdResetToken = params.get("reset");

    async function verifyByLink(token) {
      try {
        const response = await fetch(`${API}/api/auth/verify-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ token }),
        });
        const data = await readJsonSafe(response);
        if (!response.ok) throw new Error(data.error || "Link non valido o scaduto");
        setShowLogin(true);
        setIsRegister(false);
        setPendingVerificationEmail("");
        setVerifyCode("");
        setMessage("Email verificata con successo. Accedi dal tab Login.");
      } catch (error) {
        const raw = String(error.message || "");
        if (/gi[aà]\s+verificat/i.test(raw)) {
          setShowLogin(true);
          setIsRegister(false);
          setPendingVerificationEmail("");
          setVerifyCode("");
          setMessage("Email gia verificata. Accedi dal tab Login.");
        } else {
          setMessage(raw || "Verifica email fallita");
        }
      } finally {
        window.history.replaceState({}, document.title, "/");
      }
    }

    if (verifyToken) verifyByLink(verifyToken);
    if (pwdResetToken) {
      setResetToken(pwdResetToken);
      setShowLogin(true);
    }
  }, [location.search]);

  function enterApp() {
    navigate("/app");
  }

  function enterAsGuest() {
    localStorage.removeItem("pinewood_access_token");
    localStorage.removeItem("pinewood_user");
    window.dispatchEvent(new Event("pinewood-user-updated"));
    navigate("/app");
  }

  async function onLogin(e) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
      const payload = isRegister
        ? { name, email, password, acceptPrivacy, acceptTerms, marketingOptIn }
        : { email, password };
      const response = await fetch(`${API}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await readJsonSafe(response);
      if (!response.ok) {
        const fallback =
          response.status === 401
            ? "Credenziali non valide"
            : response.status === 403
              ? "Accesso non consentito"
              : t(lang, "loginFailed");
        throw new Error(data.error || fallback);
      }
      if (isRegister) {
        setPendingVerificationEmail(email);
        setVerifyCode("");
        setMessage("Registrazione creata. Controlla la mail per codice o link di verifica.");
        setBusy(false);
        return;
      }
      localStorage.setItem("pinewood_access_token", data.accessToken);
      setStoredUserProfile(data.user);
      setAccessToken(data.accessToken);
      setShowLogin(false);
      setIsRegister(false);
      setMessage("");
      navigate("/app");
    } catch (error) {
      setMessage(error.message || t(lang, "loginFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function verifyEmailByCode() {
    if (!pendingVerificationEmail || !verifyCode) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`${API}/api/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: pendingVerificationEmail, code: verifyCode }),
      });
      const data = await readJsonSafe(response);
      if (!response.ok) throw new Error(data.error || "Verifica email fallita");
      setPendingVerificationEmail("");
      setVerifyCode("");
      setIsRegister(false);
      setMessage("Email verificata. Ora puoi fare login.");
    } catch (error) {
      setMessage(error.message || "Verifica email fallita");
    } finally {
      setBusy(false);
    }
  }

  async function resendVerification() {
    if (!pendingVerificationEmail) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`${API}/api/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: pendingVerificationEmail }),
      });
      const data = await readJsonSafe(response);
      if (!response.ok) throw new Error(data.error || "Invio verifica fallito");
      setMessage("Nuova email di verifica inviata.");
    } catch (error) {
      setMessage(error.message || "Invio verifica fallito");
    } finally {
      setBusy(false);
    }
  }

  async function onForgotPassword() {
    if (!forgotEmail) return;
    setForgotBusy(true);
    setMessage("");
    try {
      const response = await fetch(`${API}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await readJsonSafe(response);
      if (!response.ok) throw new Error(data.error || "Invio mail recupero fallito");
      setForgotOpen(false);
      setMessage("Mail inviata! Controlla la tua casella di posta");
    } catch (error) {
      setMessage(error.message || "Invio mail recupero fallito");
    } finally {
      setForgotBusy(false);
    }
  }

  async function onResetPassword() {
    if (!resetToken || !resetPasswordValue) return;
    setResetBusy(true);
    setMessage("");
    try {
      const response = await fetch(`${API}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token: resetToken, newPassword: resetPasswordValue }),
      });
      const data = await readJsonSafe(response);
      if (!response.ok) throw new Error(data.error || "Reset password fallito");
      setResetToken("");
      setResetPasswordValue("");
      setMessage("Password aggiornata. Ora puoi fare login.");
      window.history.replaceState({}, document.title, "/");
    } catch (error) {
      setMessage(error.message || "Reset password fallito");
    } finally {
      setResetBusy(false);
    }
  }

  return (
    <div className="landing">
      <Box
        component="section"
        className="hero"
        sx={{
          display: "flex",
          flexDirection: "column",
          minHeight: "100dvh",
          maxHeight: "100dvh",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <video
          className="hero-video"
          autoPlay
          muted
          loop
          playsInline
        >
          <source src="/video/hero.mp4" type="video/mp4" />
        </video>
        <div className="hero-overlay" />

        <Box
          sx={{
            position: "relative",
            zIndex: 2,
            flex: "0 0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            pt: "max(12px, env(safe-area-inset-top))",
            pl: "max(16px, env(safe-area-inset-left))",
            pr: "max(16px, env(safe-area-inset-right))",
            pb: 1,
          }}
        >
          <img
            className="logo"
            src="/logo.svg"
            alt="Pinewood"
            width={220}
            height={80}
            style={{ maxWidth: "min(72vw, 260px)", height: "auto" }}
          />
        </Box>

        <Typography
          component="h1"
          className="hero-title"
          sx={{
            position: "relative",
            zIndex: 1,
            flex: "1 1 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 0,
            py: 2,
            px: 2,
            fontFamily: '"Shadows Into Light Two", cursive !important',
            fontSize: { xs: "2rem !important", sm: "2.5rem !important" },
          }}
        >
          Keep the way
        </Typography>

        <Box
          sx={{
            position: "relative",
            zIndex: 2,
            flex: "0 0 auto",
            width: "100%",
            display: "flex",
            justifyContent: "center",
            pl: "max(16px, env(safe-area-inset-left))",
            pr: "max(16px, env(safe-area-inset-right))",
            pb: "max(16px, calc(env(safe-area-inset-bottom) + 12px))",
            pt: 1,
          }}
        >
          {isLogged ? (
            <Button
              variant="contained"
              onClick={enterApp}
              sx={{
                bgcolor: "white",
                color: "#111",
                minWidth: 130,
                py: 0.7,
                px: 2.4,
                fontWeight: 700,
                "&:hover": { bgcolor: "#f3f3f3" },
              }}
            >
              {t(lang, "signIn")}
            </Button>
          ) : (
            <Stack direction="row" spacing={1} sx={{ width: "100%", justifyContent: "center", flexWrap: "wrap" }}>
              <Button
                variant="contained"
                onClick={() => setShowLogin(true)}
                sx={{
                  bgcolor: "white",
                  color: "#111",
                  minWidth: 120,
                  py: 0.7,
                  px: 2.2,
                  fontWeight: 700,
                  "&:hover": { bgcolor: "#f3f3f3" },
                }}
              >
                {t(lang, "signIn")}
              </Button>
              <Button
                variant="outlined"
                onClick={enterAsGuest}
                sx={{
                  borderColor: "rgba(255,255,255,0.8)",
                  color: "#fff",
                  minWidth: 140,
                  py: 0.7,
                  px: 2.2,
                  fontWeight: 700,
                }}
              >
                {t(lang, "enterAsGuest")}
              </Button>
            </Stack>
          )}
        </Box>
        <Drawer
          anchor="bottom"
          open={showLogin}
          onClose={() => setShowLogin(false)}
          PaperProps={{
            sx: {
              pb: "max(12px, env(safe-area-inset-bottom))",
              borderTopLeftRadius: 12,
              borderTopRightRadius: 12,
            },
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
                  <TextField
                    label={t(lang, "name")}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    fullWidth
                  />
                )}
                <TextField
                  label={t(lang, "email")}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  fullWidth
                />
                <TextField
                  label={t(lang, "password")}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  fullWidth
                />
                {!isRegister && (
                  <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                    <Button size="small" onClick={() => setForgotOpen(true)}>
                      Recupera password
                    </Button>
                  </Box>
                )}
                {isRegister && (
                  <>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={acceptPrivacy}
                          onChange={(e) => setAcceptPrivacy(e.target.checked)}
                          color="primary"
                          required
                        />
                      }
                      label="Accetto la Privacy Policy"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={acceptTerms}
                          onChange={(e) => setAcceptTerms(e.target.checked)}
                          color="primary"
                          required
                        />
                      }
                      label="Accetto i Termini di Servizio"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={marketingOptIn}
                          onChange={(e) => setMarketingOptIn(e.target.checked)}
                          color="primary"
                        />
                      }
                      label="Acconsento a comunicazioni opzionali (facoltativo)"
                    />
                    <Typography variant="caption" color="text.secondary">
                      Registrandoti accetti la nostra{" "}
                      <Link component="button" type="button" underline="hover" onClick={() => setLegalModal("privacy")}>
                        Privacy Policy
                      </Link>{" "}
                      e i{" "}
                      <Link component="button" type="button" underline="hover" onClick={() => setLegalModal("terms")}>
                        Termini di Servizio
                      </Link>
                      .
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Per i cookie e i dettagli trattamento dati vedi{" "}
                      <Link component="button" type="button" underline="hover" onClick={() => setLegalModal("cookies")}>
                        Cookie Policy
                      </Link>
                      .
                    </Typography>
                    {pendingVerificationEmail && (
                      <>
                        <Typography variant="caption" color="text.secondary">
                          Abbiamo inviato un codice a {pendingVerificationEmail}. Inseriscilo qui sotto.
                        </Typography>
                        <TextField
                          label="Codice verifica email"
                          value={verifyCode}
                          onChange={(e) => setVerifyCode(e.target.value)}
                          fullWidth
                        />
                        <Stack direction="row" spacing={1}>
                          <Button variant="outlined" onClick={verifyEmailByCode} disabled={busy || !verifyCode}>
                            Verifica codice
                          </Button>
                          <Button variant="text" onClick={resendVerification} disabled={busy}>
                            Reinvia email
                          </Button>
                        </Stack>
                      </>
                    )}
                  </>
                )}
                <Button type="submit" variant="contained" color="primary" size="large" disabled={busy}>
                  {busy ? t(lang, "wait") : isRegister ? t(lang, "createAccount") : t(lang, "signIn")}
                </Button>
                {message && (
                  <Typography
                    color={
                      /(fallit|errore|non valido|non consentito|credenziali)/i.test(message)
                        ? "error"
                        : "success.main"
                    }
                    variant="body2"
                  >
                    {message}
                  </Typography>
                )}
              </Stack>
            </Box>
          </Box>
        </Drawer>
        <Dialog
          open={Boolean(activeLegal)}
          onClose={() => setLegalModal("")}
          fullWidth
          maxWidth="md"
          scroll="paper"
        >
          <DialogTitle>{activeLegal?.title}</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={1.2}>
              <Typography variant="body2" color="text.secondary">
                {activeLegal?.version}
              </Typography>
              {(activeLegal?.paragraphs || []).map((paragraph) => (
                <Typography key={paragraph}>{paragraph}</Typography>
              ))}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 2, pb: 2 }}>
            <Button onClick={() => setLegalModal("")} variant="contained">
              Chiudi
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog open={forgotOpen} onClose={() => setForgotOpen(false)} fullWidth maxWidth="xs">
          <DialogTitle>Recupero password</DialogTitle>
          <DialogContent>
            <Stack spacing={1.2} sx={{ mt: 0.6 }}>
              <Typography variant="body2" color="text.secondary">
                Inserisci la tua email: ti inviamo un link per creare una nuova password.
              </Typography>
              <TextField
                label="Email"
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                fullWidth
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 2, pb: 2 }}>
            <Button onClick={() => setForgotOpen(false)}>Annulla</Button>
            <Button onClick={onForgotPassword} variant="contained" disabled={forgotBusy || !forgotEmail}>
              {forgotBusy ? "Invio..." : "Invia email"}
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog open={Boolean(resetToken)} onClose={() => setResetToken("")} fullWidth maxWidth="xs">
          <DialogTitle>Imposta nuova password</DialogTitle>
          <DialogContent>
            <Stack spacing={1.2} sx={{ mt: 0.6 }}>
              <Typography variant="body2" color="text.secondary">
                Inserisci la nuova password per completare il recupero.
              </Typography>
              <TextField
                label="Nuova password"
                type="password"
                value={resetPasswordValue}
                onChange={(e) => setResetPasswordValue(e.target.value)}
                fullWidth
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 2, pb: 2 }}>
            <Button onClick={() => setResetToken("")}>Annulla</Button>
            <Button onClick={onResetPassword} variant="contained" disabled={resetBusy || !resetPasswordValue}>
              {resetBusy ? "Salvo..." : "Conferma"}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </div>
  );
}
