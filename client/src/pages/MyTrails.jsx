import { useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  Container,
  Fab,
  InputAdornment,
  Menu,
  MenuItem,
  IconButton,
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  Button,
  List,
  ListItem,
  ListItemText,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import NorthRoundedIcon from "@mui/icons-material/NorthRounded";
import SouthRoundedIcon from "@mui/icons-material/SouthRounded";
import ReactQuill from "react-quill";
import { detectLanguage, t } from "../services/i18n.js";
import InternalHeader from "../components/InternalHeader.jsx";
import AppDialogTitle from "../components/AppDialogTitle.jsx";
import TrailEngagementStats from "../components/TrailEngagementStats.jsx";
import { apiFetch } from "../services/api.js";
import "react-quill/dist/quill.snow.css";

const API = import.meta.env.VITE_API_URL || "";
const QUILL_MODULES = {
  toolbar: [
    ["bold", "italic", "underline", "link"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["clean"],
  ],
};
const QUILL_FORMATS = ["bold", "italic", "underline", "link", "list", "bullet"];

function readStoredUser() {
  const raw = localStorage.getItem("pinewood_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem("pinewood_user");
    return null;
  }
}

function prettifyName(fileName) {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function MyTrails() {
  const navigate = useNavigate();
  const lang = useMemo(() => detectLanguage(), []);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("mine");
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState([]);
  const [menuState, setMenuState] = useState({ anchorEl: null, trail: null });
  const [notice, setNotice] = useState({ type: "", text: "" });
  const [loadingList, setLoadingList] = useState(false);
  const [deleteTrailId, setDeleteTrailId] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState({
    id: "",
    source: "",
    name: "",
    description: "",
    difficulty: "",
    start_location_text: "",
    start_location_lat: "",
    start_location_lon: "",
    distance_km: "",
    elevation_gain_m: "",
    elevation_loss_m: "",
    max_elevation_m: "",
    min_elevation_m: "",
    source_website_url: "",
    is_public: true,
    parkings: [],
  });
  const [parkingData, setParkingData] = useState({
    label: "",
    lat: "",
    lon: "",
    notes: "",
  });
  const [editingParkingId, setEditingParkingId] = useState(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);

  const [me, setMe] = useState(() => {
    return readStoredUser();
  });

  useEffect(() => {
    function syncUser() {
      setMe(readStoredUser());
    }
    function onAuthExpired(event) {
      const message = event?.detail?.message || t(lang, "sessionExpired");
      setNotice({ type: "error", text: message });
    }
    window.addEventListener("storage", syncUser);
    window.addEventListener("pinewood-user-updated", syncUser);
    window.addEventListener("pinewood-auth-expired", onAuthExpired);
    return () => {
      window.removeEventListener("storage", syncUser);
      window.removeEventListener("pinewood-user-updated", syncUser);
      window.removeEventListener("pinewood-auth-expired", onAuthExpired);
    };
  }, [lang]);

  useEffect(() => {
    if (!notice.text) return;
    const timer = setTimeout(() => {
      setNotice({ type: "", text: "" });
    }, 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  async function loadTrails() {
    try {
      setLoadingList(true);
      const res = await apiFetch("/api/trails");
      if (res.status === 401) {
        setNotice({ type: "error", text: t(lang, "sessionExpired") });
        navigate("/");
        return;
      }
      if (!res.ok) {
        setNotice({ type: "error", text: t(lang, "genericError") });
        return [];
      }
      const data = await res.json();
      setItems(data);
      return data;
    } catch {
      setNotice({ type: "error", text: t(lang, "genericError") });
      return [];
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    loadTrails();
  }, []);

  async function onUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!String(file.name || "").toLowerCase().endsWith(".gpx")) {
      setNotice({ type: "error", text: t(lang, "onlyGpxAllowed") });
      event.target.value = "";
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("name", prettifyName(file.name));
      const response = await apiFetch("/api/trails/upload", {
        method: "POST",
        body: form,
      });
      if (response.status === 401) {
        setNotice({ type: "error", text: t(lang, "sessionExpired") });
        return;
      }
      if (!response.ok) throw new Error();
      const uploadData = await response.json();
      setMode("mine");
      setQuery("");
      const data = await loadTrails();
      if (!data?.some((trail) => trail.id === uploadData.trailId)) {
        // Fallback: a volte la lista arriva in ritardo al primo poll.
        setTimeout(() => {
          loadTrails();
        }, 1200);
      }
      setNotice({ type: "success", text: `${t(lang, "uploadOk")} (${uploadData.trailId})` });
    } catch {
      setNotice({ type: "error", text: t(lang, "genericError") });
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  async function deleteTrail(trailId) {
    try {
      const response = await apiFetch(`/api/trails/${trailId}`, {
        method: "DELETE",
      });
      if (response.status === 401) {
        setNotice({ type: "error", text: t(lang, "sessionExpired") });
        navigate("/");
        return;
      }
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        console.error("[delete trail][MyTrails] failed", {
          status: response.status,
          payload,
          trailId,
        });
        setNotice({
          type: "error",
          text: payload?.error || `Errore eliminazione (HTTP ${response.status})`,
        });
        return;
      }
      console.info("[delete trail][MyTrails] success", { trailId });
      await loadTrails();
      setNotice({ type: "success", text: "Tracciato eliminato" });
    } catch {
      console.error("[delete trail][MyTrails] request crashed (network/CORS/server down)", { trailId });
      setNotice({ type: "error", text: t(lang, "genericError") });
    }
  }

  async function openEdit(trailId) {
    const response = await apiFetch(`/api/trails/${trailId}`);
    if (response.status === 401) {
      setNotice({ type: "error", text: t(lang, "sessionExpired") });
      navigate("/");
      return;
    }
    if (!response.ok) {
      setNotice({ type: "error", text: t(lang, "genericError") });
      return;
    }
    const trail = await response.json();
    setEditData({
      id: trail.id,
      source: trail.source || "",
      name: trail.name || "",
      description: trail.description || "",
      difficulty: trail.difficulty || "",
      start_location_text: trail.start_location_text || "",
      start_location_lat: trail.start_location_lat ?? "",
      start_location_lon: trail.start_location_lon ?? "",
      distance_km: trail.distance_km ?? "",
      elevation_gain_m: trail.elevation_gain_m ?? "",
      elevation_loss_m: trail.elevation_loss_m ?? "",
      max_elevation_m: trail.max_elevation_m ?? "",
      min_elevation_m: trail.min_elevation_m ?? "",
      source_website_url: trail.source_website_url || "",
      is_public: trail.is_public ?? true,
      parkings: Array.isArray(trail.parkings) ? trail.parkings : [],
    });
    setParkingData({ label: "", lat: "", lon: "", notes: "" });
    setEditingParkingId(null);
    setEditOpen(true);
  }

  async function saveEdit() {
    const payload = editData.source === "osm"
      ? {
          start_location_text: editData.start_location_text || null,
          start_location_lat: editData.start_location_lat === "" ? null : Number(editData.start_location_lat),
          start_location_lon: editData.start_location_lon === "" ? null : Number(editData.start_location_lon),
          is_public: editData.is_public,
        }
      : {
          name: editData.name,
          description: editData.description || null,
          difficulty: editData.difficulty || null,
          start_location_text: editData.start_location_text || null,
          start_location_lat: editData.start_location_lat === "" ? null : Number(editData.start_location_lat),
          start_location_lon: editData.start_location_lon === "" ? null : Number(editData.start_location_lon),
          distance_km: editData.distance_km === "" ? null : Number(editData.distance_km),
          elevation_gain_m: editData.elevation_gain_m === "" ? null : Number(editData.elevation_gain_m),
          elevation_loss_m: editData.elevation_loss_m === "" ? null : Number(editData.elevation_loss_m),
          max_elevation_m: editData.max_elevation_m === "" ? null : Number(editData.max_elevation_m),
          min_elevation_m: editData.min_elevation_m === "" ? null : Number(editData.min_elevation_m),
          source_website_url: (editData.source_website_url || "").trim() || null,
          is_public: editData.is_public,
        };
    const response = await apiFetch(`/api/trails/${editData.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      setNotice({ type: "error", text: t(lang, "genericError") });
      return;
    }
    setEditOpen(false);
    setNotice({ type: "success", text: t(lang, "trailUpdated") });
    await loadTrails();
  }

  async function generateDescriptionAiForEdit() {
    if (!editData.id || me?.role !== "super_admin") return;
    setAiGenerating(true);
    try {
      const res = await apiFetch(`/api/trails/${editData.id}/generate-description-ai`, {
        method: "POST",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({ type: "error", text: payload?.error || t(lang, "genericError") });
        return;
      }
      const reload = await apiFetch(`/api/trails/${editData.id}`);
      if (reload.ok) {
        const trail = await reload.json();
        setEditData((prev) => ({
          ...prev,
          description: trail.description || "",
          source_website_url: trail.source_website_url || prev.source_website_url,
        }));
      }
      if (!payload?.ok) {
        setNotice({ type: "error", text: `AI: ${payload?.reason || "generazione non applicata"}` });
      }
    } finally {
      setAiGenerating(false);
    }
  }

  function startEditParking(parking) {
    setEditingParkingId(parking.id);
    setParkingData({
      label: parking.label || "",
      lat: parking.lat ?? "",
      lon: parking.lon ?? "",
      notes: parking.notes || "",
    });
  }

  async function addOrUpdateParking() {
    if (!parkingData.label.trim() || !editData.id) return;
    const url = editingParkingId ? `/api/parkings/${editingParkingId}` : `/api/trails/${editData.id}/parkings`;
    const method = editingParkingId ? "PATCH" : "POST";
    const res = await apiFetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: parkingData.label,
        notes: parkingData.notes || null,
        lat: parkingData.lat === "" ? null : Number(parkingData.lat),
        lon: parkingData.lon === "" ? null : Number(parkingData.lon),
      }),
    });
    if (!res.ok) return;
    const reload = await apiFetch(`/api/trails/${editData.id}`);
    if (reload.ok) {
      const trail = await reload.json();
      setEditData((prev) => ({
        ...prev,
        parkings: Array.isArray(trail.parkings) ? trail.parkings : [],
      }));
    }
    setParkingData({ label: "", lat: "", lon: "", notes: "" });
    setEditingParkingId(null);
  }

  async function deleteParking(parkingId) {
    const res = await apiFetch(`/api/parkings/${parkingId}`, { method: "DELETE" });
    if (!res.ok) return;
    setEditData((prev) => ({
      ...prev,
      parkings: (prev.parkings || []).filter((p) => p.id !== parkingId),
    }));
  }

  async function removeSaved(trailId) {
    try {
      const response = await apiFetch(`/api/saved-trails/${trailId}`, {
        method: "DELETE",
      });
      if (response.status === 401) {
        setNotice({ type: "error", text: t(lang, "sessionExpired") });
        navigate("/");
        return;
      }
      await loadTrails();
    } catch {
      setNotice({ type: "error", text: t(lang, "genericError") });
    }
  }

  useEffect(() => {
    const shouldPoll = items.some(
      (trail) => trail.parse_status === "processing" || trail.parse_status === "processing_elevation"
    );
    if (!shouldPoll) return;
    const id = setInterval(() => {
      loadTrails();
    }, 10000);
    return () => clearInterval(id);
  }, [items]);

  function statusLabel(trail) {
    if (trail.parse_status === "processing") return t(lang, "processing");
    if (trail.parse_status === "processing_elevation") return t(lang, "processingElevation");
    if (trail.parse_status === "error") return t(lang, "error");
    return null;
  }

  function formatMinutesToHours(minutes) {
    if (!Number.isFinite(minutes)) return null;
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    if (h <= 0) return `${m} min`;
    return `${h} h ${m} min`;
  }

  const filtered = items
    .filter((trail) => (mode === "mine" ? trail.relation_type === "mine" : trail.relation_type === "saved"))
    .filter((trail) => trail.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <InternalHeader />

      <Container maxWidth="sm" sx={{ py: 2.5, pb: 10 }}>
        <Stack spacing={2}>
          {notice.text && (
            <Alert severity={notice.type === "success" ? "success" : "error"}>{notice.text}</Alert>
          )}

          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {t(lang, "myTrails")}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t(lang, mode === "saved" ? "trailsSavedCount" : "trailsLoadedCount")}: {filtered.length}
          </Typography>

          <Tabs
            value={mode}
            onChange={(_, v) => setMode(v)}
            variant="fullWidth"
            sx={{ bgcolor: "background.paper", borderRadius: 2 }}
          >
            <Tab value="mine" label={t(lang, "myTrailsMine")} />
            <Tab value="saved" label={t(lang, "myTrailsSaved")} />
          </Tabs>

          <TextField
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t(lang, "searchTrail")}
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />

          {loadingList && (
            <Typography color="text.secondary">{t(lang, "processing")}</Typography>
          )}

          {!loadingList && filtered.length === 0 && (
            <Typography color="text.secondary">{t(lang, "noTrailsYet")}</Typography>
          )}

          <Stack spacing={1.4}>
            {filtered.map((trail) => {
              const isMine = trail.owner_id === me?.id || trail.is_mine;
              const ownerLabel =
                trail.source === "osm"
                  ? t(lang, "pinewoodAvatar")
                  : trail.owner_name || (isMine ? me?.name || "User" : "User");
              const ownerInitial = ownerLabel.slice(0, 1).toUpperCase();
              const meAvatarSrc = me?.avatar_url ? `${API}${me.avatar_url}` : undefined;
              const ownerAvatarSrc = trail.owner_avatar_url ? `${API}${trail.owner_avatar_url}` : undefined;

              return (
                <Card
                  key={trail.id}
                  variant="outlined"
                  sx={{ overflow: "hidden", cursor: "pointer" }}
                  onClick={() =>
                    navigate(`/app/trails/${trail.id}`, { state: { backTo: "/app/my-trails" } })
                  }
                >
                  <Box
                    sx={{ width: "100%", lineHeight: 0 }}
                    dangerouslySetInnerHTML={{ __html: trail.svg_preview }}
                  />
                  <CardContent sx={{ display: "grid", gap: 1.1, p: 1.6 }}>
                    <Box
                      sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}
                    >
                      <Typography sx={{ fontWeight: 700, lineHeight: 1.2 }}>{trail.name}</Typography>
                      <Stack direction="row" spacing={0.4} sx={{ alignItems: "center" }}>
                        {trail.source === "osm" && <Chip size="small" label="CAI" color="secondary" />}
                        {trail.parse_status === "ready_no_elevation" && (
                          <Chip size="small" label={t(lang, "trail.no_elevation")} />
                        )}
                        {statusLabel(trail) && <Chip size="small" label={statusLabel(trail)} />}
                        <IconButton
                          size="small"
                          onClick={(event) => {
                            event.stopPropagation();
                            setMenuState({ anchorEl: event.currentTarget, trail });
                          }}
                        >
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </Box>

                    <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 0.8 }}>
                      {trail.distance_km != null && (
                        <Typography variant="body2" color="text.secondary">
                          {Number(trail.distance_km).toFixed(2).replace(".", ",")} km
                        </Typography>
                      )}
                      {trail.estimated_time_minutes != null && (
                        <Typography variant="body2" color="text.secondary">
                          | {formatMinutesToHours(trail.estimated_time_minutes)}
                        </Typography>
                      )}
                      {(trail.elevation_gain_m != null || trail.elevation_loss_m != null) && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ display: "inline-flex", alignItems: "center", gap: 0.2 }}
                        >
                          | <NorthRoundedIcon sx={{ fontSize: 15 }} />
                          {trail.elevation_gain_m ?? "-"}m
                          <SouthRoundedIcon sx={{ fontSize: 15, ml: 0.2 }} />
                          {trail.elevation_loss_m ?? trail.elevation_gain_m ?? "-"}m
                        </Typography>
                      )}
                      {trail.difficulty && (
                        <Typography variant="body2" color="text.secondary">
                          | {trail.difficulty}
                        </Typography>
                      )}
                    </Box>

                    <TrailEngagementStats hikersCount={trail.hikers_count} savesCount={trail.saves_count} dense />

                  <Typography variant="caption" color="text.secondary">
                    {trail.last_hiked_at
                      ? `${t(lang, "lastHikedOn")} ${new Date(trail.last_hiked_at).toLocaleDateString()}`
                      : t(lang, "lastHikedNever")}
                  </Typography>

                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                      <Avatar
                        src={isMine ? meAvatarSrc : ownerAvatarSrc}
                        sx={{
                          width: 24,
                          height: 24,
                          fontSize: "0.75rem",
                          bgcolor: (isMine && meAvatarSrc) || (!isMine && ownerAvatarSrc) ? "#fff" : undefined,
                        }}
                      >
                        {isMine ? (me?.name?.slice(0, 1).toUpperCase() || ownerInitial) : ownerInitial}
                      </Avatar>
                      <Typography variant="caption" color="text.secondary">
                        {ownerLabel}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        </Stack>
      </Container>

      {mode === "mine" && (
        <Fab
          color="primary"
          onClick={() => setUploadDialogOpen(true)}
          disabled={busy}
          sx={{ position: "fixed", right: 18, bottom: 18 }}
          aria-label={t(lang, "uploadTrail")}
        >
          <AddIcon />
        </Fab>
      )}
      <input
        id="trail-upload-input"
        hidden
        type="file"
        accept=".gpx"
        onChange={onUpload}
      />
      <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)}>
        <AppDialogTitle title={t(lang, "uploadInfoTitle")} />
        <DialogContent>
          <Typography color="text.secondary">{t(lang, "uploadInfoBody")}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)}>{t(lang, "cancel")}</Button>
          <Button
            variant="contained"
            onClick={() => {
              setUploadDialogOpen(false);
              const el = document.getElementById("trail-upload-input");
              if (el) el.click();
            }}
          >
            {t(lang, "chooseFile")}
          </Button>
        </DialogActions>
      </Dialog>

      <Menu
        anchorEl={menuState.anchorEl}
        open={Boolean(menuState.anchorEl)}
        onClose={() => setMenuState({ anchorEl: null, trail: null })}
      >
        {menuState.trail?.is_mine ? (
          <>
            <MenuItem
              onClick={async () => {
                const id = menuState.trail.id;
                setMenuState({ anchorEl: null, trail: null });
                await openEdit(id);
              }}
            >
              {t(lang, "cardMenuEdit")}
            </MenuItem>
            <MenuItem
              onClick={async () => {
                const id = menuState.trail.id;
                setMenuState({ anchorEl: null, trail: null });
                setDeleteTrailId(id);
              }}
            >
              {t(lang, "cardMenuDelete")}
            </MenuItem>
          </>
        ) : (
          <MenuItem
            onClick={async () => {
              const id = menuState.trail.id;
              setMenuState({ anchorEl: null, trail: null });
              await removeSaved(id);
            }}
          >
            {t(lang, "cardMenuUnsave")}
          </MenuItem>
        )}
      </Menu>

      <Dialog open={Boolean(deleteTrailId)} onClose={() => setDeleteTrailId(null)}>
        <AppDialogTitle title={`${t(lang, "cardMenuDelete")}?`} />
        <DialogContent>
          <Typography color="text.secondary">Con questa operazione e irreversibile.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTrailId(null)}>{t(lang, "cancel")}</Button>
          <Button
            color="error"
            onClick={async () => {
              const id = deleteTrailId;
              setDeleteTrailId(null);
              if (id) await deleteTrail(id);
            }}
            variant="contained"
          >
            {t(lang, "cardMenuDelete")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm">
        <AppDialogTitle
          title="Pubblico"
          right={
            <Switch
              size="small"
              checked={Boolean(editData.is_public)}
              onChange={(e) => setEditData((v) => ({ ...v, is_public: e.target.checked }))}
              inputProps={{ "aria-label": "Pubblico" }}
            />
          }
        />
        <DialogContent sx={{ display: "grid", gap: 1.2, pt: "10px !important", px: "1rem" }}>
          {editData.source !== "osm" && (
            <>
              <TextField
                label={t(lang, "name")}
                value={editData.name}
                onChange={(e) => setEditData((v) => ({ ...v, name: e.target.value }))}
                fullWidth
              />
              <Box
                sx={{
                  "& .ql-toolbar": { fontFamily: '"Titillium Web", sans-serif' },
                  "& .ql-editor": { minHeight: 110, fontFamily: '"Titillium Web", sans-serif' },
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  {t(lang, "description")}
                </Typography>
                <ReactQuill
                  theme="snow"
                  value={editData.description || ""}
                  onChange={(value) => setEditData((v) => ({ ...v, description: value || "" }))}
                  modules={QUILL_MODULES}
                  formats={QUILL_FORMATS}
                />
                {me?.role === "super_admin" && (
                  <Box sx={{ mt: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={generateDescriptionAiForEdit}
                      disabled={aiGenerating}
                    >
                      {aiGenerating ? t(lang, "wait") : t(lang, "generateAiDescription")}
                    </Button>
                  </Box>
                )}
              </Box>
              <TextField
                label={t(lang, "officialWebsite")}
                value={editData.source_website_url}
                onChange={(e) => setEditData((v) => ({ ...v, source_website_url: e.target.value }))}
                fullWidth
              />
              <TextField
                label={t(lang, "difficulty")}
                value={editData.difficulty}
                onChange={(e) => setEditData((v) => ({ ...v, difficulty: e.target.value }))}
                fullWidth
              />
              <Stack direction="row" spacing={1}>
                <TextField
                  label="Distanza km"
                  value={editData.distance_km}
                  onChange={(e) => setEditData((v) => ({ ...v, distance_km: e.target.value }))}
                  fullWidth
                />
                <TextField
                  label="Dislivello + m"
                  value={editData.elevation_gain_m}
                  onChange={(e) => setEditData((v) => ({ ...v, elevation_gain_m: e.target.value }))}
                  fullWidth
                />
              </Stack>
              <Stack direction="row" spacing={1}>
                <TextField
                  label="Dislivello - m"
                  value={editData.elevation_loss_m}
                  onChange={(e) => setEditData((v) => ({ ...v, elevation_loss_m: e.target.value }))}
                  fullWidth
                />
                <TextField
                  label="Altitudine max m"
                  value={editData.max_elevation_m}
                  onChange={(e) => setEditData((v) => ({ ...v, max_elevation_m: e.target.value }))}
                  fullWidth
                />
              </Stack>
              <TextField
                label="Altitudine min m"
                value={editData.min_elevation_m}
                onChange={(e) => setEditData((v) => ({ ...v, min_elevation_m: e.target.value }))}
                fullWidth
              />
            </>
          )}
          <Box sx={{ mt: 1 }}>
            <Typography sx={{ fontWeight: 700, mb: 0.6 }}>{t(lang, "parkings")}</Typography>
            <List dense sx={{ p: 0 }}>
              {(editData.parkings || []).length === 0 && (
                <ListItem sx={{ px: 0 }}>
                  <ListItemText primary={t(lang, "noParkings")} />
                </ListItem>
              )}
              {(editData.parkings || []).map((parking) => (
                <ListItem
                  key={parking.id}
                  sx={{ px: 0 }}
                  secondaryAction={
                    <Box>
                      <IconButton edge="end" onClick={() => startEditParking(parking)}>
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                      <IconButton edge="end" onClick={() => deleteParking(parking.id)}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  }
                >
                  <ListItemText
                    primary={parking.label}
                    secondary={
                      parking.lat != null && parking.lon != null
                        ? `${parking.lat}, ${parking.lon}${parking.notes ? ` - ${parking.notes}` : ""}`
                        : parking.notes || ""
                    }
                  />
                </ListItem>
              ))}
            </List>
            <Stack spacing={1} sx={{ mt: 1 }}>
              <TextField
                label={t(lang, "parkingLabel")}
                value={parkingData.label}
                onChange={(e) => setParkingData((v) => ({ ...v, label: e.target.value }))}
                fullWidth
              />
              <Stack direction="row" spacing={1}>
                <TextField
                  label={t(lang, "parkingLat")}
                  value={parkingData.lat}
                  onChange={(e) => setParkingData((v) => ({ ...v, lat: e.target.value }))}
                  fullWidth
                />
                <TextField
                  label={t(lang, "parkingLon")}
                  value={parkingData.lon}
                  onChange={(e) => setParkingData((v) => ({ ...v, lon: e.target.value }))}
                  fullWidth
                />
              </Stack>
              <TextField
                label={t(lang, "parkingNotes")}
                value={parkingData.notes}
                onChange={(e) => setParkingData((v) => ({ ...v, notes: e.target.value }))}
                fullWidth
              />
              <Button variant="outlined" startIcon={<AddIcon />} onClick={addOrUpdateParking}>
                {editingParkingId ? t(lang, "save") : t(lang, "addParking")}
              </Button>
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            color="error"
            startIcon={<DeleteOutlineIcon />}
            sx={{ mr: "auto" }}
            onClick={() => {
              if (!editData.id) return;
              setEditOpen(false);
              setDeleteTrailId(editData.id);
            }}
          >
            {t(lang, "cardMenuDelete")}
          </Button>
          <Button onClick={() => setEditOpen(false)}>{t(lang, "cancel")}</Button>
          <Button onClick={saveEdit} variant="contained">
            {t(lang, "save")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
