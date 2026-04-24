import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import InternalHeader from "../components/InternalHeader.jsx";
import AppDialogTitle from "../components/AppDialogTitle.jsx";
import { apiFetch } from "../services/api.js";

export default function Profile() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreviewSrc, setAvatarPreviewSrc] = useState("");
  const [avatarVersion, setAvatarVersion] = useState(0);
  const [notice, setNotice] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [stats, setStats] = useState({
    trails_uploaded: 0,
    trails_saved: 0,
  });
  const apiBase = import.meta.env.VITE_API_URL || "";

  const avatarSrc = useMemo(() => {
    if (!avatarUrl) return undefined;
    if (/^https?:\/\//i.test(avatarUrl) || avatarUrl.startsWith("data:") || avatarUrl.startsWith("blob:")) {
      return avatarUrl;
    }
    const base = `${apiBase}${avatarUrl}`;
    return `${base}${base.includes("?") ? "&" : "?"}v=${avatarVersion}`;
  }, [avatarUrl, apiBase, avatarVersion]);

  const visibleAvatarSrc = avatarPreviewSrc || avatarSrc;

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreviewSrc("");
      return;
    }
    const objectUrl = URL.createObjectURL(avatarFile);
    setAvatarPreviewSrc(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [avatarFile]);

  useEffect(() => {
    async function loadProfile() {
      const res = await apiFetch("/api/users/me");
      if (!res.ok) return;
      const data = await res.json();
      setName(data.name || "");
      setEmail(data.email || "");
      setAvatarUrl(data.avatar_url || "");
      setAvatarVersion(Date.now());
      setStats({
        trails_uploaded: data.trails_uploaded ?? 0,
        trails_saved: data.trails_saved ?? 0,
      });
    }
    loadProfile();
  }, []);

  async function saveProfile() {
    const shouldChangePassword = Boolean(currentPassword && newPassword);
    if ((currentPassword && !newPassword) || (!currentPassword && newPassword)) {
      setNotice("Compila sia password attuale che nuova password");
      return;
    }

    if (shouldChangePassword) {
      const pwdRes = await apiFetch("/api/users/me/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!pwdRes.ok) {
        const data = await pwdRes.json().catch(() => ({}));
        setNotice(data.error || "Errore cambio password");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
    }

    const form = new FormData();
    form.append("name", name);
    if (avatarFile) form.append("avatar", avatarFile);
    const res = await apiFetch("/api/users/me", { method: "PATCH", body: form });
    if (!res.ok) {
      setNotice("Errore salvataggio profilo");
      return;
    }
    const user = await res.json();
    localStorage.setItem("pinewood_user", JSON.stringify(user));
    setAvatarUrl(user.avatar_url || "");
    setAvatarVersion(Date.now());
    setAvatarFile(null);
    setStats({
      trails_uploaded: user.trails_uploaded ?? 0,
      trails_saved: user.trails_saved ?? 0,
    });
    setNotice(shouldChangePassword ? "Profilo e password aggiornati" : "Profilo aggiornato");
  }

  async function deleteAccount() {
    setDeleting(true);
    try {
      const res = await apiFetch("/api/users/me", { method: "DELETE" });
      if (!res.ok) {
        setNotice("Errore eliminazione account");
        return;
      }
      localStorage.removeItem("pinewood_access_token");
      localStorage.removeItem("pinewood_user");
      window.dispatchEvent(new Event("pinewood-user-updated"));
      navigate("/");
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <InternalHeader />
      <Container maxWidth="sm" sx={{ py: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Dashboard
          </Typography>
          <Stack direction="row" spacing={1}>
            <Box sx={{ flex: 1, bgcolor: "#f4f8f2", borderRadius: 1.4, p: 1.2 }}>
              <Typography variant="caption" color="text.secondary">Caricati</Typography>
              <Typography sx={{ fontWeight: 800 }}>{stats.trails_uploaded}</Typography>
            </Box>
            <Box sx={{ flex: 1, bgcolor: "#f4f8f2", borderRadius: 1.4, p: 1.2 }}>
              <Typography variant="caption" color="text.secondary">Salvati</Typography>
              <Typography sx={{ fontWeight: 800 }}>{stats.trails_saved}</Typography>
            </Box>
          </Stack>
          {notice && <Alert severity="success">{notice}</Alert>}
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar
              src={visibleAvatarSrc}
              sx={{ width: 56, height: 56 }}
            >
              {name?.slice(0, 1).toUpperCase() || "P"}
            </Avatar>
            <Button component="label" variant="outlined">
              Carica avatar
              <input
                hidden
                type="file"
                accept="image/*"
                onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
              />
            </Button>
          </Stack>
          <TextField label="Nome visualizzato" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
          <TextField label="Email" value={email} fullWidth disabled />
          <TextField
            label="Password attuale"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            fullWidth
          />
          <TextField
            label="Nuova password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            fullWidth
          />
          <Stack direction="row" spacing={1} justifyContent="space-between">
            <Button variant="outlined" color="error" onClick={() => setDeleteDialogOpen(true)}>
              Elimina account
            </Button>
            <Button variant="contained" onClick={saveProfile}>
              Salva modifiche
            </Button>
          </Stack>
        </Stack>
      </Container>
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <AppDialogTitle title="Eliminare account?" />
        <DialogContent>
          <Typography color="text.secondary">
            Questa azione elimina definitivamente account, profilo, tracciati caricati, tracciati salvati, statistiche e
            dati collegati. Non e possibile annullarla.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
            Annulla
          </Button>
          <Button color="error" variant="contained" onClick={deleteAccount} disabled={deleting}>
            {deleting ? "Elimino..." : "Elimina definitivamente"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
