import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import NorthRoundedIcon from "@mui/icons-material/NorthRounded";
import SouthRoundedIcon from "@mui/icons-material/SouthRounded";
import { useNavigate } from "react-router-dom";
import { detectLanguage, t } from "../services/i18n.js";
import InternalHeader from "../components/InternalHeader.jsx";
import BookmarkPinewoodIcon from "../components/BookmarkPinewoodIcon.jsx";
import TrailEngagementStats from "../components/TrailEngagementStats.jsx";
import { apiFetch } from "../services/api.js";
import { requestQuickLocation, subscribeLocation } from "../services/locationTracker.js";

const API = import.meta.env.VITE_API_URL || "";
const PAGE_SIZE = 6;

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

export default function Home() {
  const navigate = useNavigate();
  const lang = useMemo(() => detectLanguage(), []);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]);
  const [notice, setNotice] = useState({ type: "", text: "" });
  const [myPos, setMyPos] = useState(null);
  const [locationResolved, setLocationResolved] = useState(false);
  const [isGuest, setIsGuest] = useState(() => !localStorage.getItem("pinewood_access_token"));
  const [heroBackground, setHeroBackground] = useState("");
  const [nearIndex, setNearIndex] = useState(0);
  const [nearTouchStartX, setNearTouchStartX] = useState(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [me, setMe] = useState(() => {
    const raw = localStorage.getItem("pinewood_user");
    return raw ? JSON.parse(raw) : null;
  });

  useEffect(() => {
    function syncAuthState() {
      const raw = localStorage.getItem("pinewood_user");
      setMe(raw ? JSON.parse(raw) : null);
      setIsGuest(!localStorage.getItem("pinewood_access_token"));
    }
    window.addEventListener("storage", syncAuthState);
    window.addEventListener("pinewood-user-updated", syncAuthState);
    return () => {
      window.removeEventListener("storage", syncAuthState);
      window.removeEventListener("pinewood-user-updated", syncAuthState);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const unsub = subscribeLocation((snapshot) => {
      if (!active || !Array.isArray(snapshot?.position)) return;
      setMyPos(snapshot.position);
      setLocationResolved(true);
    });
    requestQuickLocation().then((position) => {
      if (!active) return;
      if (position) setMyPos(position);
      setLocationResolved(true);
    });
    return () => {
      active = false;
      unsub();
    };
  }, []);

  useEffect(() => {
    if (!locationResolved) return;
    let active = true;
    async function loadDiscover() {
      const qs = new URLSearchParams();
      qs.set("sort", "near");
      if (myPos) {
        qs.set("lat", String(myPos[0]));
        qs.set("lon", String(myPos[1]));
      }
      const res = await apiFetch(`/api/trails/discover?${qs.toString()}`);
      if (res.status === 401) {
        navigate("/");
        return;
      }
      if (!res.ok) {
        if (active) setNotice({ type: "error", text: t(lang, "genericError") });
        return;
      }
      const data = await res.json();
      if (active) setItems(data);
    }
    loadDiscover();
    return () => {
      active = false;
    };
  }, [lang, navigate, myPos, locationResolved]);

  useEffect(() => {
    let active = true;
    const maxBackgrounds = 4;
    const maxAttempts = 6;

    function preload(url) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
      });
    }

    async function pickRandomHomeBackground() {
      if (!active) return;
      for (let i = 0; i < maxAttempts; i += 1) {
        const n = Math.floor(Math.random() * maxBackgrounds) + 1;
        const idx = String(n).padStart(2, "0");
        const candidate = `/bg_home_${idx}.webp`;
        const loaded = await preload(candidate);
        if (!active) return;
        if (loaded) {
          setHeroBackground(candidate);
          return;
        }
      }
      const fallback = "/bg_home.webp";
      const fallbackLoaded = await preload(fallback);
      if (!active) return;
      if (fallbackLoaded) setHeroBackground(fallback);
    }

    pickRandomHomeBackground();
    return () => {
      active = false;
    };
  }, []);

  async function toggleSaved(trail) {
    if (trail.is_mine) return;
    const method = trail.is_saved ? "DELETE" : "POST";
    const url = trail.is_saved ? `/api/saved-trails/${trail.id}` : "/api/saved-trails";
    const body = trail.is_saved ? undefined : JSON.stringify({ trailId: trail.id });
    const res = await apiFetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body,
    });
    if (!res.ok) {
      setNotice({ type: "error", text: t(lang, "genericError") });
      return;
    }
    setItems((prev) =>
      prev.map((row) =>
        row.id === trail.id
          ? {
              ...row,
              is_saved: !trail.is_saved,
              saves_count: Math.max(0, (row.saves_count ?? 0) + (trail.is_saved ? -1 : 1)),
            }
          : row
      )
    );
    setNotice({ type: "success", text: trail.is_saved ? t(lang, "unsavedOk") : t(lang, "savedOk") });
  }

  const filtered = useMemo(() => {
    return items.filter((trail) => trail.name?.toLowerCase().includes(query.toLowerCase()));
  }, [items, query]);

  const nearest = useMemo(() => {
    const withDistance = items
      .map((trail) => {
        if (!myPos || trail.start_lat == null || trail.start_lon == null) {
          return { trail, d: Number.POSITIVE_INFINITY };
        }
        return {
          trail,
          d: distanceMeters(myPos, [Number(trail.start_lat), Number(trail.start_lon)]),
        };
      })
      .sort((a, b) => a.d - b.d)
      .map((x) => x.trail);
    return withDistance.slice(0, 5);
  }, [items, myPos]);

  const popular = useMemo(() => {
    const score = (trail) => (trail.hikers_count || 0) * 2 + (trail.saves_count || 0);
    return [...filtered].sort((a, b) => score(b) - score(a));
  }, [filtered]);

  const popularVisible = useMemo(() => popular.slice(0, visibleCount), [popular, visibleCount]);

  useEffect(() => {
    if (!items.length) return;
    setNearIndex((idx) => (nearest.length ? Math.min(idx, nearest.length - 1) : 0));
    setVisibleCount(PAGE_SIZE);
  }, [items, nearest.length]);

  function formatMinutesToHours(minutes) {
    if (!Number.isFinite(minutes)) return null;
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    if (h <= 0) return `${m} min`;
    return `${h} h ${m} min`;
  }

  function renderTrailCard(trail, options = {}) {
    const fixedHeight = Boolean(options.fixedHeight);
    const ownerLabel = trail.owner_name || "User";
    const ownerInitial = ownerLabel.slice(0, 1).toUpperCase();
    const meAvatarSrc = me?.avatar_url ? `${API}${me.avatar_url}` : undefined;
    const ownerAvatarSrc = trail.owner_avatar_url ? `${API}${trail.owner_avatar_url}` : undefined;

    return (
      <Card
        key={trail.id}
        variant="outlined"
        sx={{
          overflow: "hidden",
          cursor: "pointer",
          height: fixedHeight ? 378 : "auto",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={() => navigate(`/app/trails/${trail.id}`, { state: { backTo: "/app" } })}
      >
        <Box sx={{ width: "100%", lineHeight: 0, position: "relative" }}>
          {!trail.is_mine && !isGuest && (
            <IconButton
              size="small"
              disableRipple
              onClick={(event) => {
                event.stopPropagation();
                toggleSaved(trail);
              }}
              sx={{
                position: "absolute",
                top: 0,
                right: 0,
                pt: 0,
                zIndex: 2,
                color: "#8B919A",
                "&:hover": { bgcolor: "transparent" },
                "&.Mui-focusVisible": { bgcolor: "transparent" },
              }}
              aria-label={t(lang, "saveTrail")}
            >
              <BookmarkPinewoodIcon filled={Boolean(trail.is_saved)} sx={{ fontSize: 26 }} />
            </IconButton>
          )}
          <Box dangerouslySetInnerHTML={{ __html: trail.svg_preview }} />
        </Box>
        <CardContent sx={{ display: "grid", gap: 1.1, p: 1.6, flex: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
            <Typography sx={{ fontWeight: 700, lineHeight: 1.2 }}>{trail.name}</Typography>
            <Stack direction="row" spacing={0.4} sx={{ alignItems: "center" }}>
              {trail.source === "osm" && <Chip size="small" label="CAI" color="secondary" />}
            </Stack>
          </Box>

          <TrailEngagementStats hikersCount={trail.hikers_count} savesCount={trail.saves_count} dense />

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

          <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
            <Avatar
              src={trail.is_mine ? meAvatarSrc : ownerAvatarSrc}
              sx={{
                width: 24,
                height: 24,
                fontSize: "0.75rem",
                bgcolor:
                  (trail.is_mine && meAvatarSrc) || (!trail.is_mine && ownerAvatarSrc) ? "#fff" : undefined,
              }}
            >
              {trail.is_mine ? (me?.name?.slice(0, 1).toUpperCase() || ownerInitial) : ownerInitial}
            </Avatar>
            <Typography variant="caption" color="text.secondary">
              {ownerLabel}
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  function onNearTouchStart(event) {
    const x = event.touches?.[0]?.clientX;
    setNearTouchStartX(Number.isFinite(x) ? x : null);
  }

  function onNearTouchEnd(event) {
    if (nearTouchStartX == null) return;
    const x = event.changedTouches?.[0]?.clientX;
    if (!Number.isFinite(x)) return;
    const delta = x - nearTouchStartX;
    setNearTouchStartX(null);
    if (Math.abs(delta) < 35) return;
    if (delta < 0) setNearIndex((v) => Math.min(nearest.length - 1, v + 1));
    else setNearIndex((v) => Math.max(0, v - 1));
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        touchAction: "pan-y",
      }}
    >
      <InternalHeader />
      <Box
        sx={{
          height: 300,
          width: "100%",
          overflow: "hidden",
          position: "relative",
          backgroundImage: heroBackground ? `url('${heroBackground}')` : "none",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundColor: "#1b2a1f",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(15,26,18,0.22) 0%, rgba(15,26,18,0.42) 100%)",
          }}
        />
        <Typography
          sx={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            color: "#fff",
            textAlign: "center",
            fontFamily: '"Shadows Into Light Two", cursive !important',
            fontSize: "2.5rem !important",
            textShadow: "0 8px 32px rgba(0,0,0,0.55)",
          }}
        >
          Keep the way
        </Typography>
      </Box>

      <Container maxWidth="sm" sx={{ py: 2.5, pb: 10 }}>
        <Stack spacing={2}>
          <Typography
            sx={{
              fontFamily: '"Shadows Into Light Two", cursive !important',
              color: "#111",
              fontSize: "1rem !important",
              lineHeight: 1.6,
              mt: 0.4,
            }}
          >
            Pinewood nasce per chi cammina davvero, senza filtri e senza rumore. Keep the way significa restare sul
            percorso, il mood è semplice: natura, presenza, direzione. Meno distrazioni, più sentiero.
            <br />
            <br />
            Pinewood ti accompagna dove serve davvero: fuori, passo dopo passo, con testa leggera e sguardo aperto.
            Keep the way. Sempre.
          </Typography>

          {nearest.length > 0 && (
            <Stack spacing={1}>
              <Typography variant="h6" sx={{ fontWeight: 700, mt: 1.1 }}>
                I più vicini
              </Typography>
              <Box
                onTouchStart={onNearTouchStart}
                onTouchEnd={onNearTouchEnd}
                sx={{
                  overflow: "hidden",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    width: `${nearest.length * 100}%`,
                    transform: `translateX(-${nearIndex * (100 / nearest.length)}%)`,
                    transition: "transform .28s ease",
                  }}
                >
                  {nearest.map((trail) => (
                    <Box key={`near-${trail.id}`} sx={{ width: `${100 / nearest.length}%`, px: 0.1 }}>
                      {renderTrailCard(trail, { fixedHeight: true })}
                    </Box>
                  ))}
                </Box>
              </Box>
              <Stack direction="row" spacing={0.9} sx={{ justifyContent: "center", pt: 0.2 }}>
                {nearest.map((_, idx) => (
                  <Box
                    key={`dot-${idx}`}
                    onClick={() => setNearIndex(idx)}
                    sx={{
                      width: idx === nearIndex ? 20 : 8,
                      height: 8,
                      borderRadius: 999,
                      bgcolor: idx === nearIndex ? "#2D4F1E" : "rgba(45,79,30,0.25)",
                      transition: "all .22s ease",
                      cursor: "pointer",
                    }}
                  />
                ))}
              </Stack>
            </Stack>
          )}

          <Typography variant="h6" sx={{ fontWeight: 700, mt: 1.6 }}>
            Tutti i trail
          </Typography>

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

          {notice.text && (
            <Alert severity={notice.type === "error" ? "error" : "success"}>{notice.text}</Alert>
          )}

          <Typography variant="caption" color="text.secondary">{popular.length} tracciati disponibili</Typography>

          <Stack spacing={1.4}>
            {popularVisible.map((trail) => renderTrailCard(trail))}
          </Stack>
          {visibleCount < popular.length && (
            <Button variant="outlined" onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}>
              Carica altri
            </Button>
          )}
        </Stack>
      </Container>
    </Box>
  );
}
