import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import InternalHeader from "../components/InternalHeader.jsx";
import { apiFetch } from "../services/api.js";

const API = import.meta.env.VITE_API_URL || "";

function readStoredUser() {
  const raw = localStorage.getItem("pinewood_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function AdminUsers() {
  const user = useMemo(() => readStoredUser(), []);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);

  async function loadUsers(search = "") {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`/api/admin/users?q=${encodeURIComponent(search)}&page=1&limit=100`);
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || `Errore caricamento utenti (HTTP ${res.status})`);
      }
      const payload = await res.json();
      setRows(payload?.users || []);
    } catch (e) {
      setError(e?.message || "Errore caricamento utenti");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function blockToggle(targetId, blockedAt) {
    const endpoint = blockedAt ? `/api/admin/users/${targetId}/unblock` : `/api/admin/users/${targetId}/block`;
    const res = await apiFetch(endpoint, { method: "PATCH" });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      throw new Error(payload?.error || `Errore operazione utente (HTTP ${res.status})`);
    }
    await loadUsers(q);
  }

  async function deleteUser(targetId, name) {
    const ok = window.confirm(`Eliminare definitivamente l'utente "${name}" e tutti i suoi contenuti?`);
    if (!ok) return;
    const res = await apiFetch(`/api/admin/users/${targetId}`, { method: "DELETE" });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      throw new Error(payload?.error || `Errore eliminazione utente (HTTP ${res.status})`);
    }
    await loadUsers(q);
  }

  if (user?.role !== "super_admin") {
    return (
      <Container maxWidth="sm" sx={{ py: 3 }}>
        <InternalHeader />
        <Alert severity="error" sx={{ mt: 2 }}>
          Accesso negato: area riservata al super admin Pinewood.
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 2 }}>
      <InternalHeader />
      <Paper sx={{ p: 2, mt: 1.5 }}>
        <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>
          Super Admin - Utenti
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <TextField
            size="small"
            fullWidth
            placeholder="Cerca per email o nome"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") loadUsers(q);
            }}
          />
          <Button variant="contained" onClick={() => loadUsers(q)}>
            Cerca
          </Button>
        </Stack>

        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <Stack spacing={1.2}>
            {rows.map((row) => (
              <Paper key={row.id} variant="outlined" sx={{ p: 1.2 }}>
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1.2} alignItems="center">
                    <Avatar
                      src={row.avatar_url ? `${API}${row.avatar_url}` : undefined}
                      sx={{ width: 34, height: 34 }}
                    >
                      {String(row.name || "U").slice(0, 1).toUpperCase()}
                    </Avatar>
                    <Box>
                      <Typography fontWeight={700}>{row.name || "Senza nome"}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {row.email}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Pubblicati: {row.trails_published} | Salvati: {row.trails_saved} | Ruolo: {row.role}
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      variant="outlined"
                      color={row.blocked_at ? "success" : "warning"}
                      onClick={() => blockToggle(row.id, row.blocked_at)}
                    >
                      {row.blocked_at ? "Sblocca" : "Blocca"}
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      onClick={() => deleteUser(row.id, row.name || row.email)}
                    >
                      Elimina
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}
      </Paper>
    </Container>
  );
}
