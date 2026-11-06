import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import SignalCellularAltIcon from "@mui/icons-material/SignalCellularAlt";
import PlaceIcon from "@mui/icons-material/Place";
import { useNavigate } from "react-router-dom";
import { detectLanguage, t } from "../services/i18n.js";
import InternalHeader from "../components/InternalHeader.jsx";
import PageContainer from "../components/PageContainer.jsx";
import { cardGridSx } from "../theme/layout.js";
import { apiFetch } from "../services/api.js";
import { requestQuickLocation, subscribeLocation } from "../services/locationTracker.js";

const PAGE_SIZE = 12;
const GEO_RADIUS_KM = 100;
const TRAILS_CACHE_KEY = "pinewood_trails_discover_cache_v1";
const TRAILS_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

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

function readTrailsCache() {
  try {
    const raw = localStorage.getItem(TRAILS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.items) || !parsed.items.length) return null;
    if (typeof parsed.ts !== "number") return null;
    if (Date.now() - parsed.ts > TRAILS_CACHE_MAX_AGE_MS) return null;
    return parsed.items;
  } catch {
    return null;
  }
}

function writeTrailsCache(items) {
  try {
    localStorage.setItem(
      TRAILS_CACHE_KEY,
      JSON.stringify({ ts: Date.now(), items: Array.isArray(items) ? items : [] })
    );
  } catch {
    /* quota */
  }
}

async function geocode(text) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&limit=1`;
  try {
    const res = await fetch(url, {
      headers: { "Accept-Language": "it", "User-Agent": "Pinewood/1.0" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.length) return null;
    return { lat: Number(data[0].lat), lon: Number(data[0].lon), name: data[0].display_name.split(",")[0] };
  } catch {
    return null;
  }
}

export default function Trails() {
  const navigate = useNavigate();
  const lang = useMemo(() => detectLanguage(), []);
  const cachedOnBoot = useMemo(() => readTrailsCache(), []);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState(() => cachedOnBoot || []);
  const [loadingTrails, setLoadingTrails] = useState(() => !(cachedOnBoot && cachedOnBoot.length));
  const [myPos, setMyPos] = useState(null);
  const [locationResolved, setLocationResolved] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [geoResult, setGeoResult] = useState(null);
  const debounceRef = useRef(null);
  const itemsRef = useRef(items);
  const fetchGen = useRef(0);
  itemsRef.current = items;

  useEffect(() => {
    let active = true;
    const unsub = subscribeLocation((snapshot) => {
      if (!active || !Array.isArray(snapshot?.position)) return;
      setMyPos(snapshot.position);
      setLocationResolved(true);
    });
    const timer = window.setTimeout(() => {
      if (active) setLocationResolved(true);
    }, 2500);
    requestQuickLocation().then((position) => {
      if (!active) return;
      if (position) setMyPos(position);
      setLocationResolved(true);
    });
    return () => {
      active = false;
      window.clearTimeout(timer);
      unsub();
    };
  }, []);

  useEffect(() => {
    if (!locationResolved) return;
    let active = true;
    let progressiveTimer = 0;
    const gen = ++fetchGen.current;

    async function loadTrails() {
      if (!itemsRef.current.length) setLoadingTrails(true);
      try {
        const qs = new URLSearchParams();
        qs.set("sort", "near");
        if (myPos) {
          qs.set("lat", String(myPos[0]));
          qs.set("lon", String(myPos[1]));
        }
        const res = await apiFetch(`/api/trails/discover?${qs.toString()}`);
        if (!active || gen !== fetchGen.current) return;
        if (res.status === 401) {
          navigate("/");
          return;
        }
        if (!res.ok) {
          // Tieni la cache a video; non restare bloccati su "Caricamento".
          return;
        }
        const data = await res.json();
        if (!active || gen !== fetchGen.current || !Array.isArray(data)) return;
        writeTrailsCache(data);
        const first = data.slice(0, PAGE_SIZE);
        setItems(first);
        setLoadingTrails(false);
        if (data.length <= first.length) return;
        let offset = first.length;
        const pump = () => {
          if (!active || gen !== fetchGen.current) return;
          offset = Math.min(data.length, offset + PAGE_SIZE * 2);
          setItems(data.slice(0, offset));
          if (offset < data.length) progressiveTimer = window.setTimeout(pump, 40);
        };
        progressiveTimer = window.setTimeout(pump, 40);
      } catch {
        /* rete: resta la cache */
      } finally {
        if (active && gen === fetchGen.current) setLoadingTrails(false);
      }
    }
    loadTrails();
    return () => {
      active = false;
      if (progressiveTimer) window.clearTimeout(progressiveTimer);
    };
  }, [lang, navigate, myPos, locationResolved]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setGeoResult(null);
      return;
    }

    const nameMatches = itemsRef.current.filter((trail) =>
      trail.name?.toLowerCase().includes(trimmed.toLowerCase())
    );
    if (nameMatches.length >= 3) {
      setGeoResult(null);
      return;
    }

    let cancelled = false;
    debounceRef.current = setTimeout(async () => {
      if (cancelled) return;
      const result = await geocode(trimmed);
      if (cancelled) return;
      if (result) setGeoResult(result);
    }, 600);

    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const itemsWithDist = useMemo(() => {
    return items.map((trail) => {
      const start =
        Number.isFinite(Number(trail.start_lat)) && Number.isFinite(Number(trail.start_lon))
          ? [Number(trail.start_lat), Number(trail.start_lon)]
          : null;
      const _myDist =
        myPos && start ? distanceMeters(myPos, start) : Number.POSITIVE_INFINITY;
      return { ...trail, _myDist };
    });
  }, [items, myPos]);

  const results = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    let list = itemsWithDist;

    if (geoResult) {
      const geoPos = [geoResult.lat, geoResult.lon];
      list = list
        .map((trail) => {
          const start =
            Number.isFinite(Number(trail.start_lat)) && Number.isFinite(Number(trail.start_lon))
              ? [Number(trail.start_lat), Number(trail.start_lon)]
              : null;
          return {
            ...trail,
            _geoDist: start ? distanceMeters(geoPos, start) : Number.POSITIVE_INFINITY,
          };
        })
        .filter((trail) => trail._geoDist <= GEO_RADIUS_KM * 1000)
        .sort((a, b) => a._geoDist - b._geoDist);
    }

    if (trimmed) {
      const matches = list.filter((trail) => trail.name?.toLowerCase().includes(trimmed));
      if (matches.length > 0) {
        return [...matches].sort((a, b) => a._myDist - b._myDist);
      }
    }

    return [...list].sort((a, b) => a._myDist - b._myDist);
  }, [itemsWithDist, query, geoResult]);

  const visible = useMemo(() => results.slice(0, visibleCount), [results, visibleCount]);

  function formatMinutesToHours(minutes) {
    if (!Number.isFinite(minutes)) return null;
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    if (h <= 0) return `${m} min`;
    return `${h}h ${m}min`;
  }

  function renderTrailCard(trail) {
    return (
      <Box
        key={trail.id}
        onClick={() => navigate(`/app/trails/${trail.id}`, { state: { backTo: "/app/trails" } })}
        sx={{
          display: "flex",
          flexDirection: { xs: "row", md: "column" },
          alignItems: "stretch",
          bgcolor: "#fff",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: "10px",
          overflow: "hidden",
          cursor: "pointer",
          height: { md: "100%" },
          transition: "box-shadow .18s ease",
          "&:hover": { boxShadow: "0 4px 18px rgba(0,0,0,0.1)" },
        }}
      >
        <Box
          sx={{
            width: { xs: 100, md: "100%" },
            minWidth: { xs: 100, md: "auto" },
            minHeight: { xs: 90, md: 140 },
            bgcolor: "#c8ddc8",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            overflow: "hidden",
            "& svg": { width: "100%", height: "auto", display: "block" },
            "& svg rect": { fill: "none" },
          }}
          dangerouslySetInnerHTML={{ __html: trail.svg_preview }}
        />

        <Box sx={{ flex: 1, p: 1.4, display: "flex", flexDirection: "column", justifyContent: "center", gap: 0.3, minWidth: 0 }}>
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: "0.93rem",
              lineHeight: 1.25,
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {trail.name}
          </Typography>

          <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, mt: 0.2, overflow: "hidden" }}>
            {trail.distance_km != null && (
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, flexShrink: 0 }}>
                {Number(trail.distance_km).toFixed(1).replace(".", ",")} km
              </Typography>
            )}
            {trail.estimated_time_minutes != null && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "inline-flex", alignItems: "center", gap: 0.3, flexShrink: 0 }}
              >
                <AccessTimeIcon sx={{ fontSize: 14 }} />
                {formatMinutesToHours(trail.estimated_time_minutes)}
              </Typography>
            )}
            {trail.difficulty && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "inline-flex", alignItems: "center", gap: 0.3, flexShrink: 0 }}
              >
                <SignalCellularAltIcon sx={{ fontSize: 14 }} />
                {trail.difficulty}
              </Typography>
            )}
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <InternalHeader />

      <PageContainer sx={{ py: { xs: 2, md: 3 }, pb: { xs: 10, md: 6 } }}>
        <Stack spacing={{ xs: 1.5, md: 2.5 }}>
          <TextField
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={lang === "it" ? "Cerca per nome o luogo..." : "Search by name or place..."}
            size="small"
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />

          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {loadingTrails && items.length === 0
                ? lang === "it"
                  ? "Caricamento…"
                  : "Loading…"
                : `${results.length} ${lang === "it" ? "tracciati" : "trails"}`}
            </Typography>

            {geoResult && (
              <Chip
                icon={<PlaceIcon sx={{ fontSize: 15 }} />}
                label={`Entro ${GEO_RADIUS_KM} km da ${geoResult.name}`}
                size="small"
                onDelete={() => {
                  setGeoResult(null);
                  setQuery("");
                }}
                sx={{
                  fontWeight: 600,
                  "& .MuiChip-icon": { color: "#2d4f1e" },
                }}
              />
            )}
          </Box>

          {loadingTrails && items.length === 0 && (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 1, py: 4 }}>
              <CircularProgress size={22} thickness={5} sx={{ color: "#2d4f1e" }} />
              <Typography variant="body2" color="text.secondary">
                {lang === "it" ? "Carico i percorsi…" : "Loading trails…"}
              </Typography>
            </Box>
          )}

          <Box sx={cardGridSx}>{visible.map((trail) => renderTrailCard(trail))}</Box>

          {visible.length === 0 && items.length > 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 3 }}>
              {t(lang, "noTrailsYet")}
            </Typography>
          )}

          {!loadingTrails && items.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 3 }}>
              {lang === "it" ? "Nessun percorso disponibile." : "No trails available."}
            </Typography>
          )}

          {visibleCount < results.length && (
            <Button variant="outlined" onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}>
              {lang === "it" ? "Carica altri" : "Load more"}
            </Button>
          )}
        </Stack>
      </PageContainer>
    </Box>
  );
}
