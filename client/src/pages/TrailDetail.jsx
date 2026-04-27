import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Switch,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import ShareOutlinedIcon from "@mui/icons-material/ShareOutlined";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import NorthRoundedIcon from "@mui/icons-material/NorthRounded";
import SouthRoundedIcon from "@mui/icons-material/SouthRounded";
import LandscapeRoundedIcon from "@mui/icons-material/LandscapeRounded";
import WbSunnyRoundedIcon from "@mui/icons-material/WbSunnyRounded";
import CloudRoundedIcon from "@mui/icons-material/CloudRounded";
import UmbrellaRoundedIcon from "@mui/icons-material/UmbrellaRounded";
import AcUnitRoundedIcon from "@mui/icons-material/AcUnitRounded";
import ThunderstormRoundedIcon from "@mui/icons-material/ThunderstormRounded";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import InternalHeader from "../components/InternalHeader.jsx";
import BookmarkPinewoodIcon from "../components/BookmarkPinewoodIcon.jsx";
import TrailEngagementStats from "../components/TrailEngagementStats.jsx";
import AppDialogTitle from "../components/AppDialogTitle.jsx";
import { detectLanguage, t } from "../services/i18n.js";
import { apiFetch } from "../services/api.js";
import { getLastKnownLocation, requestQuickLocation } from "../services/locationTracker.js";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

const API = import.meta.env.VITE_API_URL || "";
const OSM_TILE_TEMPLATE = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
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

function lon2tile(lon, zoom) {
  return Math.floor(((lon + 180) / 360) * 2 ** zoom);
}

function lat2tile(lat, zoom) {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** zoom);
}

async function warmupTilesForLine(line, { installedPwa = false } = {}) {
  if (!("caches" in window) || !Array.isArray(line) || line.length === 0) return { ok: false };
  const cache = await caches.open("pinewood-osm-tiles");
  const subs = ["a", "b", "c"];
  const zooms = installedPwa ? [13, 14, 15, 16] : [13, 14, 15];
  const maxTiles = installedPwa ? 220 : 120;
  const tileUrls = new Set();
  const stride = Math.max(1, Math.floor(line.length / 60));
  for (let i = 0; i < line.length; i += stride) {
    const [lat, lon] = line[i];
    for (const z of zooms) {
      const x = lon2tile(lon, z);
      const y = lat2tile(lat, z);
      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dy = -1; dy <= 1; dy += 1) {
          const sub = subs[Math.abs(x + y + dx + dy) % subs.length];
          tileUrls.add(
            OSM_TILE_TEMPLATE.replace("{s}", sub)
              .replace("{z}", String(z))
              .replace("{x}", String(x + dx))
              .replace("{y}", String(y + dy))
          );
          if (tileUrls.size >= maxTiles) break;
        }
        if (tileUrls.size >= maxTiles) break;
      }
      if (tileUrls.size >= maxTiles) break;
    }
    if (tileUrls.size >= maxTiles) break;
  }

  let okCount = 0;
  const urls = Array.from(tileUrls);
  for (const url of urls) {
    try {
      const existing = await cache.match(url);
      if (existing) {
        okCount += 1;
        continue;
      }
      const resp = await fetch(url, { mode: "no-cors", cache: "no-store" });
      await cache.put(url, resp.clone());
      okCount += 1;
    } catch {
      // best effort
    }
  }
  return { ok: okCount > 0, partial: okCount < urls.length };
}

function FitTrailBounds({ line }) {
  const map = useMap();
  useEffect(() => {
    if (!line?.length) return;
    if (line.length === 1) {
      map.setView(line[0], 15, { animate: false });
      return;
    }
    map.fitBounds(line, { padding: [18, 18] });
  }, [map, line]);
  return null;
}

export default function TrailDetail() {
  const { trailId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const lang = useMemo(() => detectLanguage(), []);
  const [trail, setTrail] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState({
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
  });
  const [parkingData, setParkingData] = useState({
    label: "",
    lat: "",
    lon: "",
    notes: "",
  });
  const [editingParkingId, setEditingParkingId] = useState(null);
  const [playAlert, setPlayAlert] = useState({ type: "", text: "" });
  const [playStarting, setPlayStarting] = useState(false);
  const [offlineBusy, setOfflineBusy] = useState(false);
  const [offlineDialog, setOfflineDialog] = useState({
    open: false,
    text: "",
    success: false,
  });
  const [isGuest, setIsGuest] = useState(() => !localStorage.getItem("pinewood_access_token"));
  const [forecastDays, setForecastDays] = useState([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareNotice, setShareNotice] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [me, setMe] = useState(() => readStoredUser());

  function resolveBackTarget() {
    const raw = location.state?.backTo;
    return typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//") ? raw : null;
  }

  function getSharePayload() {
    const shareText = `Guarda questo percorso che ho trovato su Pinewood: ${trail?.name || ""}`;
    const shareUrl = typeof window !== "undefined" ? window.location.href : "";
    return {
      title: trail?.name || "Percorso Pinewood",
      text: shareText,
      url: shareUrl,
    };
  }

  function handleBack() {
    const backTarget = resolveBackTarget();
    if (backTarget) {
      navigate(backTarget);
      return;
    }
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/app");
  }

  async function shareNow() {
    const payload = getSharePayload();
    try {
      if (navigator.share) {
        await navigator.share(payload);
        setShareNotice("");
        return;
      }
      await navigator.clipboard.writeText(`${payload.text}\n${payload.url}`);
      setShareNotice("Testo di condivisione copiato negli appunti.");
    } catch {
      setShareNotice("Non sono riuscito a condividere adesso.");
    }
  }

  useEffect(() => {
    function syncAuthState() {
      setIsGuest(!localStorage.getItem("pinewood_access_token"));
      setMe(readStoredUser());
    }
    function onAuthExpired(event) {
      const message = event?.detail?.message || t(lang, "sessionExpired");
      setPlayAlert({ type: "error", text: message });
    }
    window.addEventListener("storage", syncAuthState);
    window.addEventListener("pinewood-user-updated", syncAuthState);
    window.addEventListener("pinewood-auth-expired", onAuthExpired);
    return () => {
      window.removeEventListener("storage", syncAuthState);
      window.removeEventListener("pinewood-user-updated", syncAuthState);
      window.removeEventListener("pinewood-auth-expired", onAuthExpired);
    };
  }, [lang]);

  useEffect(() => {
    let active = true;
    async function load() {
      const res = await apiFetch(`/api/trails/${trailId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (active) setTrail(data);
    }
    load();
    return () => {
      active = false;
    };
  }, [trailId, navigate]);

  useEffect(() => {
    if (!trail) return;
    const startCoords =
      trail.start_point_geojson?.coordinates?.length === 2
        ? [trail.start_point_geojson.coordinates[1], trail.start_point_geojson.coordinates[0]]
        : null;
    const lat =
      trail.start_location_lat != null ? Number(trail.start_location_lat) : startCoords?.[0] ?? null;
    const lon =
      trail.start_location_lon != null ? Number(trail.start_location_lon) : startCoords?.[1] ?? null;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    let active = true;
    async function loadForecast() {
      const res = await apiFetch(`/api/weather/forecast?lat=${lat}&lon=${lon}&days=7`);
      if (!res.ok) return;
      const data = await res.json();
      if (!active) return;
      setForecastDays(Array.isArray(data.days) ? data.days : []);
    }
    loadForecast();
    return () => {
      active = false;
    };
  }, [trail]);

  function toLatLng(coords) {
    return coords.map(([lon, lat]) => [lat, lon]);
  }

  const line = trail?.geom_geojson?.coordinates ? toLatLng(trail.geom_geojson.coordinates) : [];
  const mapCenter = line[0] || [41.9, 12.5];
  const elevationProfile = Array.isArray(trail?.elevation_profile) ? trail.elevation_profile : [];
  const hasElevationProfile =
    trail?.parse_status !== "processing_elevation" &&
    trail?.parse_status !== "ready_no_elevation" &&
    elevationProfile.length > 1;

  function buildElevationPath(profile, width, height, pad) {
    const minD = profile[0].distance_m;
    const maxD = profile[profile.length - 1].distance_m || minD + 1;
    const elevs = profile.map((p) => p.elevation_m);
    const minE = Math.min(...elevs);
    const maxE = Math.max(...elevs);
    const spanD = Math.max(1, maxD - minD);
    const spanE = Math.max(1, maxE - minE);
    const points = profile.map((p) => {
      const x = pad + ((p.distance_m - minD) / spanD) * (width - pad * 2);
      const y = height - pad - ((p.elevation_m - minE) / spanE) * (height - pad * 2);
      return { x, y };
    });
    const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    return { d, minE: Math.round(minE), maxE: Math.round(maxE) };
  }

  function openEdit() {
    setEditData({
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
    });
    setEditOpen(true);
  }

  function detectRouteType() {
    if (!line.length) return t(lang, "noData");
    const [startLat, startLon] = line[0];
    const [endLat, endLon] = line[line.length - 1];
    const meters =
      Math.sqrt((startLat - endLat) ** 2 + (startLon - endLon) ** 2) * 111320;
    return meters <= 250 ? "Anello" : "Lineare";
  }

  function formatKm(value) {
    if (value == null) return t(lang, "noData");
    return `${Number(value).toFixed(2).replace(".", ",")} km`;
  }

  function formatMeters(value) {
    if (value == null) return t(lang, "noData");
    return `${Number(value).toLocaleString("it-IT")} m`;
  }

  function formatMinutesToHours(minutes) {
    if (!Number.isFinite(minutes)) return t(lang, "noData");
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    if (h <= 0) return `${m} min`;
    return `${h} h ${m} min`;
  }

  function weatherIconByCode(code) {
    if (code == null) return <CloudRoundedIcon sx={{ color: "#78909c" }} />;
    if (code === 0 || code === 1) return <WbSunnyRoundedIcon sx={{ color: "#f6b93b" }} />;
    if (code === 2 || code === 3 || code === 45 || code === 48)
      return <CloudRoundedIcon sx={{ color: "#78909c" }} />;
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82))
      return <UmbrellaRoundedIcon sx={{ color: "#4a90e2" }} />;
    if (code >= 71 && code <= 77) return <AcUnitRoundedIcon sx={{ color: "#64b5f6" }} />;
    if (code >= 95) return <ThunderstormRoundedIcon sx={{ color: "#8e44ad" }} />;
    return <CloudRoundedIcon sx={{ color: "#78909c" }} />;
  }

  function dayLabel(dateIso) {
    const d = new Date(dateIso);
    return d.toLocaleDateString(lang === "it" ? "it-IT" : "en-US", { weekday: "short", day: "2-digit" });
  }

  function distanceMeters(a, b) {
    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(b[0] - a[0]);
    const dLon = toRad(b[1] - a[1]);
    const lat1 = toRad(a[0]);
    const lat2 = toRad(b[0]);
    const x =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  async function startNavigation() {
    if (isGuest) {
      setPlayAlert({ type: "warning", text: t(lang, "guestPlayNotAllowed") });
      return;
    }
    if (!line.length) {
      setPlayAlert({ type: "error", text: "Tracciato non disponibile." });
      return;
    }
    if (playStarting) return;
    const isLocalhost =
      window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const secureOk = window.isSecureContext || isLocalhost;
    if (!secureOk) {
      setPlayAlert({
        type: "error",
        text: "GPS non disponibile su connessione non sicura. Apri in HTTPS.",
      });
      return;
    }
    if (!navigator.geolocation) {
      setPlayAlert({ type: "error", text: "Geolocalizzazione non supportata su questo dispositivo." });
      return;
    }

    setPlayStarting(true);
    try {
      const initialPosition = getLastKnownLocation();
      // Keep location tracker warm, but never block the transition on GPS.
      void requestQuickLocation({ timeoutMs: 3500 });
      const isStandalone =
        window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
      const res = await apiFetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trailId }),
      });
      if (!res.ok) {
        setPlayStarting(false);
        return;
      }
      const data = await res.json();
      navigate(`/app/navigation/${data.sessionId}`, {
        replace: true,
        state: {
          fromTrailDetail: true,
          trailId: String(trailId),
          backTo: resolveBackTarget(),
          initialPosition,
        },
      });
      // Continue offline warmup in background after route transition.
      void warmupTilesForLine(line, { installedPwa: Boolean(isStandalone) });
    } catch {
      setPlayStarting(false);
    }
  }

  async function forceOfflineForTrail() {
    if (!line.length || offlineBusy) return;
    setOfflineBusy(true);
    try {
      const isStandalone =
        window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
      const out = await warmupTilesForLine(line, { installedPwa: Boolean(isStandalone) });
      if (!out.ok) {
        setOfflineDialog({
          open: true,
          success: false,
          text: "Non sono riuscito a preparare la mappa offline adesso. Riprova con una rete migliore.",
        });
        return;
      }
      setOfflineDialog({
        open: true,
        success: true,
        text: out.partial
          ? "Mappa offline pronta in parte. Le zone principali del percorso sono disponibili."
          : "Traccia scaricata offline. Sei pronto per partire!",
      });
    } finally {
      setOfflineBusy(false);
    }
  }

  async function saveEdit() {
    const payload = trail.source === "osm"
      ? {
          start_location_text: editData.start_location_text || null,
          start_location_lat:
            editData.start_location_lat === "" ? null : Number(editData.start_location_lat),
          start_location_lon:
            editData.start_location_lon === "" ? null : Number(editData.start_location_lon),
        }
      : {
          name: editData.name,
          description: editData.description || null,
          difficulty: editData.difficulty || null,
          start_location_text: editData.start_location_text || null,
          start_location_lat:
            editData.start_location_lat === "" ? null : Number(editData.start_location_lat),
          start_location_lon:
            editData.start_location_lon === "" ? null : Number(editData.start_location_lon),
          distance_km: editData.distance_km === "" ? null : Number(editData.distance_km),
          elevation_gain_m:
            editData.elevation_gain_m === "" ? null : Number(editData.elevation_gain_m),
          elevation_loss_m:
            editData.elevation_loss_m === "" ? null : Number(editData.elevation_loss_m),
          max_elevation_m:
            editData.max_elevation_m === "" ? null : Number(editData.max_elevation_m),
          min_elevation_m:
            editData.min_elevation_m === "" ? null : Number(editData.min_elevation_m),
          source_website_url: (editData.source_website_url || "").trim() || null,
          is_public: editData.is_public,
        };

    const res = await apiFetch(`/api/trails/${trailId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return;
    const reload = await apiFetch(`/api/trails/${trailId}`);
    if (reload.ok) {
      const data = await reload.json();
      setTrail(data);
    }
    setEditOpen(false);
  }

  async function generateDescriptionAi() {
    if (!trail?.id || me?.role !== "super_admin" || !trail?.is_mine) return;
    setAiGenerating(true);
    try {
      const res = await apiFetch(`/api/trails/${trail.id}/generate-description-ai`, {
        method: "POST",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPlayAlert({ type: "error", text: payload?.error || t(lang, "genericError") });
        return;
      }
      const reload = await apiFetch(`/api/trails/${trail.id}`);
      if (reload.ok) {
        const data = await reload.json();
        setTrail(data);
        setEditData((prev) => ({ ...prev, description: data.description || "" }));
      }
      if (!payload?.ok) {
        setPlayAlert({
          type: "warning",
          text: `AI: ${payload?.reason || "generazione non applicata"}`,
        });
      }
    } finally {
      setAiGenerating(false);
    }
  }

  async function deleteCurrentTrail() {
    if (!trail?.id || !trail?.is_mine || trail?.source !== "user") return;
    let res;
    try {
      res = await apiFetch(`/api/trails/${trail.id}`, { method: "DELETE" });
    } catch (error) {
      console.error("[delete trail][TrailDetail] request crashed (network/CORS/server down)", {
        trailId: trail.id,
        message: error?.message || String(error),
      });
      setPlayAlert({ type: "error", text: t(lang, "genericError") });
      return;
    }
    if (res.status === 401) {
      setPlayAlert({ type: "error", text: t(lang, "sessionExpired") });
      return;
    }
    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      console.error("[delete trail][TrailDetail] failed", {
        status: res.status,
        payload,
        trailId: trail.id,
      });
      setPlayAlert({
        type: "error",
        text: payload?.error || `Errore eliminazione (HTTP ${res.status})`,
      });
      return;
    }
    console.info("[delete trail][TrailDetail] success", { trailId: trail.id });
    setDeleteConfirmOpen(false);
    setEditOpen(false);
    navigate("/app/my-trails", { replace: true });
  }

  function renderInlineBold(text, keyBase) {
    return text.split(/(\*\*.+?\*\*)/g).map((part, idx) => {
      if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
        return (
          <Box key={`${keyBase}-b-${idx}`} component="strong" sx={{ fontWeight: 700 }}>
            {part.slice(2, -2)}
          </Box>
        );
      }
      return (
        <Box key={`${keyBase}-t-${idx}`} component="span">
          {part}
        </Box>
      );
    });
  }

  function renderDescriptionContent(text) {
    if (!text) return null;
    const raw = String(text).trim();
    if (/<[a-z][\s\S]*>/i.test(raw)) {
      return <Box sx={{ color: "#2f2f2f" }} dangerouslySetInnerHTML={{ __html: raw }} />;
    }
    const lines = raw.split("\n");
    const blocks = [];
    let i = 0;
    while (i < lines.length) {
      if (lines[i].startsWith("- ")) {
        const items = [];
        while (i < lines.length && lines[i].startsWith("- ")) {
          items.push(lines[i].slice(2));
          i += 1;
        }
        blocks.push(
          <Box key={`ul-${i}`} component="ul" sx={{ m: 0, pl: 2.4 }}>
            {items.map((item, idx) => (
              <Box key={`li-${i}-${idx}`} component="li" sx={{ color: "#2f2f2f", lineHeight: 1.5 }}>
                {renderInlineBold(item, `li-${i}-${idx}`)}
              </Box>
            ))}
          </Box>
        );
        continue;
      }
      if (!lines[i].trim()) {
        blocks.push(<Box key={`sp-${i}`} sx={{ height: 8 }} />);
        i += 1;
        continue;
      }
      blocks.push(
        <Typography key={`p-${i}`} sx={{ color: "#2f2f2f", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
          {renderInlineBold(lines[i], `p-${i}`)}
        </Typography>
      );
      i += 1;
    }
    return <Stack spacing={0.4}>{blocks}</Stack>;
  }

  async function addOrUpdateParking() {
    if (!parkingData.label.trim()) return;
    if (editingParkingId) {
      const res = await apiFetch(`/api/parkings/${editingParkingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: parkingData.label,
          notes: parkingData.notes || null,
          lat: parkingData.lat === "" ? null : Number(parkingData.lat),
          lon: parkingData.lon === "" ? null : Number(parkingData.lon),
        }),
      });
      if (!res.ok) return;
    } else {
      const res = await apiFetch(`/api/trails/${trailId}/parkings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: parkingData.label,
          notes: parkingData.notes || null,
          lat: parkingData.lat === "" ? null : Number(parkingData.lat),
          lon: parkingData.lon === "" ? null : Number(parkingData.lon),
        }),
      });
      if (!res.ok) return;
    }
    setParkingData({ label: "", lat: "", lon: "", notes: "" });
    setEditingParkingId(null);
    const reload = await apiFetch(`/api/trails/${trailId}`);
    if (reload.ok) setTrail(await reload.json());
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

  async function deleteParking(parkingId) {
    const res = await apiFetch(`/api/parkings/${parkingId}`, { method: "DELETE" });
    if (!res.ok) return;
    setTrail((prev) => ({
      ...prev,
      parkings: (prev.parkings || []).filter((p) => p.id !== parkingId),
    }));
  }

  async function toggleSavedTrail() {
    if (isGuest) return;
    if (!trail || trail.is_mine) return;
    const method = trail.is_saved ? "DELETE" : "POST";
    const url = trail.is_saved ? `/api/saved-trails/${trail.id}` : "/api/saved-trails";
    const body = trail.is_saved ? undefined : JSON.stringify({ trailId: trail.id });
    const res = await apiFetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body,
    });
    if (!res.ok) return;
    setTrail((prev) =>
      prev
        ? {
            ...prev,
            is_saved: !prev.is_saved,
            saves_count: Math.max(0, (prev.saves_count ?? 0) + (prev.is_saved ? -1 : 1)),
          }
        : prev
    );
  }

  if (!trail) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
        <InternalHeader />
        <Container maxWidth="sm" sx={{ py: 3 }}>
          <Typography color="text.secondary">{t(lang, "processing")}</Typography>
        </Container>
      </Box>
    );
  }

  const ownerAvatarSrc = trail.owner_avatar_url ? `${API}${trail.owner_avatar_url}` : "/avatar.svg";

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <InternalHeader />
      {playAlert.text && (
        <Box sx={{ px: 1.5, pt: 1 }}>
          <Alert
            severity={playAlert.type === "warning" ? "warning" : "error"}
            onClose={() => setPlayAlert({ type: "", text: "" })}
          >
            {playAlert.text}
          </Alert>
        </Box>
      )}
      <Container maxWidth="sm" sx={{ py: 1.2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 0 }}>
            <IconButton
              size="small"
              onClick={handleBack}
              aria-label="Torna indietro"
              sx={{ ml: "-10px" }}
            >
              <ChevronLeftRoundedIcon />
            </IconButton>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
              <IconButton size="small" onClick={() => setShareOpen(true)} aria-label="Condividi percorso">
                <ShareOutlinedIcon fontSize="small" />
              </IconButton>
              {trail.is_mine && (
                <IconButton size="small" onClick={openEdit} aria-label={t(lang, "cardMenuEdit")}>
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
              )}
              {!trail.is_mine && !isGuest && (
                <IconButton
                  size="small"
                  onClick={toggleSavedTrail}
                  aria-label={t(lang, "saveTrail")}
                  sx={{ color: "#8B919A" }}
                >
                  <BookmarkPinewoodIcon filled={Boolean(trail.is_saved)} sx={{ fontSize: 22 }} />
                </IconButton>
              )}
            </Box>
          </Box>
          <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1, mt: 0.15 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: "#111111", minWidth: 0 }}>
              {trail.name}
            </Typography>
            <Stack direction="row" spacing={0.6}>
              {trail.source === "osm" && <Chip size="small" label="CAI" color="secondary" />}
              {trail.parse_status === "ready_no_elevation" && (
                <Chip size="small" label={t(lang, "trail.no_elevation")} />
              )}
            </Stack>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.7, mt: 0.1 }}>
            <Avatar
              src={ownerAvatarSrc}
              sx={{
                width: 22,
                height: 22,
                fontSize: "0.68rem",
                bgcolor: "#fff",
              }}
            >
              {(trail.owner_name || "P").slice(0, 1).toUpperCase()}
            </Avatar>
            <Typography variant="caption" color="text.secondary">
              Caricato da {trail.owner_name || "Pinewood"}
            </Typography>
          </Box>
        </Box>
      </Container>
      <Box sx={{ width: "100%", height: 260, overflow: "hidden" }}>
            <MapContainer
              center={mapCenter}
              zoom={13}
              style={{ width: "100%", height: "100%" }}
              scrollWheelZoom
              attributionControl={false}
              zoomControl={false}
            >
              <FitTrailBounds line={line} />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {line.length > 1 && <Polyline positions={line} pathOptions={{ color: "#2D4F1E", weight: 4 }} />}
              {line.length > 0 && (
                <CircleMarker center={line[0]} radius={6} pathOptions={{ color: "#4a8c5c", fillOpacity: 1 }}>
                  <Popup>{t(lang, "startPoint")}</Popup>
                </CircleMarker>
              )}
              {line.length > 0 && (
                <CircleMarker
                  center={line[line.length - 1]}
                  radius={6}
                  pathOptions={{ color: "#c9a84c", fillOpacity: 1 }}
                >
                  <Popup>End</Popup>
                </CircleMarker>
              )}
              {(trail.parkings || []).map((parking) =>
                parking.lat != null && parking.lon != null ? (
                  <Marker key={parking.id} position={[parking.lat, parking.lon]}>
                    <Popup>
                      <strong>P</strong> {parking.label}
                    </Popup>
                  </Marker>
                ) : null
              )}
            </MapContainer>
      </Box>

      <Box sx={{ width: "100%", bgcolor: "#0f2517", pt: "24px", pb: "24px", mt: 0, mb: "9.6px" }}>
          <Stack spacing={0.9}>
            <Box sx={{ px: 1.6, pb: 0.2 }}>
              <TrailEngagementStats
                hikersCount={trail.hikers_count}
                savesCount={trail.saves_count}
                variant="body2"
                lightOnDark
              />
            </Box>
            {(trail.distance_km != null || trail.difficulty) && (
              <Box sx={{ display: "flex", justifyContent: "flex-start", gap: 2.2, flexWrap: "wrap" }}>
                {trail.distance_km != null && (
                  <Typography sx={{ color: "#fff", fontSize: "0.98rem", px: 1.6 }}>
                    <strong>Distanza:</strong> {formatKm(trail.distance_km)}
                  </Typography>
                )}
                {trail.difficulty && (
                  <Typography sx={{ color: "#fff", fontSize: "0.98rem", px: 1.6 }}>
                    <strong>Difficoltà:</strong> {trail.difficulty}
                  </Typography>
                )}
              </Box>
            )}
            {(trail.elevation_gain_m != null || trail.elevation_loss_m != null) && (
              <Typography sx={{ color: "#fff", fontSize: "0.98rem", px: 1.6 }}>
                <strong>Dislivello:</strong>{" "}
                <NorthRoundedIcon sx={{ fontSize: 17, verticalAlign: "text-bottom", color: "#fff" }} />
                {formatMeters(trail.elevation_gain_m)} |{" "}
                <SouthRoundedIcon sx={{ fontSize: 17, verticalAlign: "text-bottom", color: "#fff" }} />
                {formatMeters(trail.elevation_loss_m)}
              </Typography>
            )}
            {(trail.min_elevation_m != null || trail.max_elevation_m != null) && (
              <Box sx={{ display: "flex", justifyContent: "flex-start", gap: 2.2, flexWrap: "wrap" }}>
                {trail.min_elevation_m != null && (
                    <Typography sx={{ color: "#fff", fontSize: "0.98rem", px: 1.6 }}>
                      <LandscapeRoundedIcon sx={{ fontSize: 16, verticalAlign: "text-bottom", mr: 0.3, color: "#fff" }} />
                      <strong>Min:</strong> {formatMeters(trail.min_elevation_m)}
                    </Typography>
                )}
                {trail.max_elevation_m != null && (
                    <Typography sx={{ color: "#fff", fontSize: "0.98rem", px: 1.6 }}>
                      <LandscapeRoundedIcon sx={{ fontSize: 21, verticalAlign: "text-bottom", mr: 0.35, color: "#fff" }} />
                      <strong>Max:</strong> {formatMeters(trail.max_elevation_m)}
                    </Typography>
                )}
              </Box>
            )}
            {(trail.estimated_time_minutes != null || line.length > 0) && (
              <Stack spacing={0.2}>
                {trail.estimated_time_minutes != null && (
                  <Typography sx={{ color: "#fff", fontSize: "0.98rem", px: 1.6 }}>
                    <strong>Tempo stimato:</strong> {formatMinutesToHours(trail.estimated_time_minutes)}
                  </Typography>
                )}
                {line.length > 0 && (
                  <Typography sx={{ color: "#fff", fontSize: "0.98rem", px: 1.6 }}>
                    <strong>Tipo:</strong> {detectRouteType()}
                  </Typography>
                )}
              </Stack>
            )}
          </Stack>
      </Box>

      <Container maxWidth="sm" sx={{ pb: 6 }}>
        <Stack spacing={2}>
          <Box sx={{ px: 1.5, py: 0.8 }}>
            <Stack spacing={1.1}>
              {trail.description && renderDescriptionContent(trail.description)}

              {trail.start_location_text && (
                <Typography sx={{ color: "#2f2f2f" }}>
                  <strong>{t(lang, "startPoint")}:</strong> {trail.start_location_text}
                </Typography>
              )}
              {trail.source_website_url && (
                <Typography sx={{ color: "#2f2f2f" }}>
                  <strong>{t(lang, "officialSource")}:</strong>{" "}
                  <a
                    href={
                      String(trail.source_website_url).startsWith("http")
                        ? trail.source_website_url
                        : `https://${trail.source_website_url}`
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t(lang, "officialSourceLink")}
                  </a>
                </Typography>
              )}
              {(trail.start_location_lat != null && trail.start_location_lon != null) && (
                <Button
                  variant="text"
                  href={`https://www.google.com/maps/dir/?api=1&destination=${trail.start_location_lat},${trail.start_location_lon}`}
                  target="_blank"
                  rel="noreferrer"
                  sx={{ justifyContent: "flex-start", px: 0 }}
                >
                  {t(lang, "openNavigator")}
                </Button>
              )}

              <Box sx={{ pt: 1 }}>
                {forecastDays.length > 0 && (
                  <Box sx={{ mb: 1.2, width: "100vw", ml: "calc(50% - 50vw)", mr: "calc(50% - 50vw)" }}>
                    <Box sx={{ bgcolor: "#eef1f3", borderRadius: 0, px: 0, pt: "1rem", pb: "1rem" }}>
                      <Box
                        sx={{
                          display: "flex",
                          overflowX: "auto",
                          scrollbarWidth: "none",
                          msOverflowStyle: "none",
                          "&::-webkit-scrollbar": { display: "none" },
                        }}
                      >
                        {forecastDays.slice(0, 7).map((day, idx, arr) => (
                        <Box
                          key={day.date}
                          sx={{
                            minWidth: "33.3333%",
                            px: 0.7,
                            py: 0.85,
                            display: "grid",
                            justifyItems: "center",
                            gap: 0.35,
                            position: "relative",
                            "&::after":
                              idx < arr.length - 1
                                ? {
                                    content: '""',
                                    position: "absolute",
                                    right: 0,
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    width: "1px",
                                    height: "62%",
                                    backgroundColor: "#b9c1c8",
                                  }
                                : undefined,
                          }}
                        >
                          <Typography sx={{ fontSize: "0.72rem", fontWeight: 700 }}>{dayLabel(day.date)}</Typography>
                          {weatherIconByCode(day.weather_code)}
                          <Typography sx={{ fontSize: "0.75rem", fontWeight: 700 }}>
                            {Math.round(day.temp_max_c ?? 0)}° / {Math.round(day.temp_min_c ?? 0)}°
                          </Typography>
                          <Typography sx={{ fontSize: "0.68rem", color: "text.secondary" }}>
                            pioggia {day.rain_prob_pct ?? "--"}%
                          </Typography>
                        </Box>
                        ))}
                      </Box>
                    </Box>
                  </Box>
                )}
                <Typography sx={{ fontWeight: 700, mb: 0.8 }}>{t(lang, "elevationProfile")}</Typography>
                {hasElevationProfile ? (
                  <Box sx={{ p: 0 }}>
                    {(() => {
                      const width = 500;
                      const height = 140;
                      const pad = 10;
                      const path = buildElevationPath(elevationProfile, width, height, pad);
                      return (
                        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="140" role="img">
                          <path d={path.d} fill="none" stroke="#2D4F1E" strokeWidth="2.2" strokeLinecap="round" />
                          <text x="6" y="150" fontSize="1rem" fill="#666">
                            {path.minE}m
                          </text>
                          <text x={width - 64} y="0" fontSize="1rem" fill="#666" dominantBaseline="hanging">
                            {path.maxE}m
                          </text>
                        </svg>
                      );
                    })()}
                  </Box>
                ) : (
                  <Typography color="text.secondary">{t(lang, "trail.no_elevation")}</Typography>
                )}
              </Box>

              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pt: 0.8 }}>
                <Stack direction="row" spacing={0.8}>
                  <IconButton
                    component={isGuest ? "button" : "a"}
                    href={isGuest ? undefined : `${API}/api/trails/download-gpx/${trail.id}`}
                    target={isGuest ? undefined : "_blank"}
                    rel={isGuest ? undefined : "noreferrer"}
                    disabled={isGuest}
                    aria-label={t(lang, "gpxDownload")}
                    sx={{
                      width: 56,
                      height: 56,
                      bgcolor: "#8b5a2b",
                      "&:hover": { bgcolor: "#744a22" },
                      "&.Mui-disabled": { bgcolor: "#8b5a2b", opacity: 0.45 },
                    }}
                  >
                    <Box
                      component="img"
                      src="/download_offline.svg"
                      alt=""
                      sx={{ width: 30, height: 30, filter: "brightness(0) invert(1)" }}
                    />
                  </IconButton>
                  <IconButton
                    onClick={forceOfflineForTrail}
                    disabled={offlineBusy || isGuest}
                    aria-label={t(lang, "mapForceOffline")}
                    sx={{
                      width: 56,
                      height: 56,
                      bgcolor: "#d97706",
                      "&:hover": { bgcolor: "#c26400" },
                      "&.Mui-disabled": { bgcolor: "#d97706", opacity: 0.45 },
                    }}
                  >
                    <Box
                      component="img"
                      src="/cloud_download.svg"
                      alt=""
                      sx={{ width: 30, height: 30, filter: "brightness(0) invert(1)" }}
                    />
                  </IconButton>
                </Stack>
                <IconButton
                  onClick={startNavigation}
                  disabled={playStarting || isGuest}
                  sx={{
                    width: 56,
                    height: 56,
                    bgcolor: "primary.main",
                    color: "#ffffff",
                    "&:hover": { bgcolor: "primary.dark", color: "#ffffff" },
                    "&:active": { bgcolor: "primary.main", color: "#ffffff" },
                    "&.Mui-focusVisible": { bgcolor: "primary.main", color: "#ffffff" },
                    "& .MuiSvgIcon-root": { color: "#ffffff" },
                    "&.Mui-disabled": {
                      bgcolor: "primary.main",
                      opacity: 0.65,
                      color: "#ffffff",
                    },
                    "&.Mui-disabled .MuiSvgIcon-root": { color: "#ffffff" },
                  }}
                >
                  <PlayArrowRoundedIcon sx={{ fontSize: 28, color: "#ffffff" }} />
                </IconButton>
              </Box>
              {isGuest && (
                <Typography variant="caption" color="text.secondary">
                  {t(lang, "guestReadOnlyHint")}
                </Typography>
              )}
            </Stack>
          </Box>
        </Stack>
      </Container>

      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        fullWidth
        maxWidth={false}
        sx={{
          "& .MuiDialog-paper": {
            width: "90%",
            maxWidth: "90%",
            m: 0,
          },
        }}
      >
        <AppDialogTitle
          title="Pubblico"
          right={
            trail.is_mine ? (
              <Switch
                size="small"
                checked={Boolean(editData.is_public)}
                onChange={(e) => setEditData((v) => ({ ...v, is_public: e.target.checked }))}
                inputProps={{ "aria-label": "Pubblico" }}
              />
            ) : null
          }
        />
        <DialogContent sx={{ display: "grid", gap: 1.2, pt: "10px !important", px: "1rem" }}>
          {trail.source !== "osm" && (
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
                {trail.is_mine && me?.role === "super_admin" && (
                  <Box sx={{ mt: 1 }}>
                    <Button size="small" variant="outlined" onClick={generateDescriptionAi} disabled={aiGenerating}>
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
          {trail.is_mine && (
            <Box sx={{ mt: 1 }}>
              <Typography sx={{ fontWeight: 700, mb: 0.6 }}>{t(lang, "parkings")}</Typography>
              <List dense sx={{ p: 0 }}>
                {(trail.parkings || []).length === 0 && (
                  <ListItem sx={{ px: 0 }}>
                    <ListItemText primary={t(lang, "noParkings")} />
                  </ListItem>
                )}
                {(trail.parkings || []).map((parking) => (
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
          )}
        </DialogContent>
        <DialogActions>
          {trail.is_mine && trail.source === "user" && (
            <Button
              color="error"
              startIcon={<DeleteOutlineIcon />}
              sx={{ mr: "auto" }}
              onClick={() => {
                setEditOpen(false);
                setDeleteConfirmOpen(true);
              }}
            >
              {t(lang, "cardMenuDelete")}
            </Button>
          )}
          <Button onClick={() => setEditOpen(false)}>{t(lang, "cancel")}</Button>
          <Button onClick={saveEdit} variant="contained">
            {t(lang, "save")}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <AppDialogTitle title={`${t(lang, "cardMenuDelete")}?`} />
        <DialogContent>
          <Typography color="text.secondary">Con questa operazione e irreversibile.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>{t(lang, "cancel")}</Button>
          <Button color="error" variant="contained" onClick={deleteCurrentTrail}>
            {t(lang, "cardMenuDelete")}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={offlineDialog.open}
        onClose={() => (offlineBusy ? undefined : setOfflineDialog({ open: false, text: "", success: false }))}
        fullWidth
        maxWidth="xs"
      >
        <AppDialogTitle
          title="Percorso offline"
          icon={offlineDialog.success ? <CheckCircleRoundedIcon sx={{ color: "#2e7d32" }} /> : null}
        />
        <DialogContent>
          <Typography color="text.secondary">{offlineDialog.text}</Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setOfflineDialog({ open: false, text: "", success: false })}
            disabled={offlineBusy}
            variant="contained"
          >
            Chiudi
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={shareOpen} onClose={() => setShareOpen(false)} fullWidth maxWidth="xs">
        <AppDialogTitle title="Condividi percorso" />
        <DialogContent sx={{ display: "grid", gap: 1.1 }}>
          <Box sx={{ borderRadius: 1, overflow: "hidden", border: "1px solid", borderColor: "divider", lineHeight: 0 }}>
            {trail.svg_preview ? (
              <Box dangerouslySetInnerHTML={{ __html: trail.svg_preview }} />
            ) : (
              <Box sx={{ py: 3, textAlign: "center" }}>
                <Typography variant="body2" color="text.secondary">
                  Anteprima non disponibile
                </Typography>
              </Box>
            )}
          </Box>
          <Typography sx={{ fontWeight: 700 }}>{trail.name}</Typography>
          <Typography variant="body2" color="text.secondary">
            Guarda questo percorso che ho trovato su Pinewood.
          </Typography>
          {shareNotice && (
            <Alert severity="info" sx={{ py: 0 }}>
              {shareNotice}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShareOpen(false)}>Chiudi</Button>
          <Button onClick={shareNow} variant="contained">
            Condividi
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
