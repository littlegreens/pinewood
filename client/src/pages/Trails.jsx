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
  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]);
  const [loadingTrails, setLoadingTrails] = useState(false);
  const [myPos, setMyPos] = useState(null);
  const [locationResolved, setLocationResolved] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [geoResult, setGeoResult] = useState(null);
  const debounceRef = useRef(null);
  const itemsRef = useRef(items);
  const loadedOnce = useRef(false);
  itemsRef.current = items;

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
    if (!locationResolved || loadedOnce.current) return;
    loadedOnce.current = true;
    let active = true;
    let progressiveTimer = 0;
    async function loadTrails() {
      setLoadingTrails(true);
      try {
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
        if (!res.ok) return;
        const data = await res.json();
        if (!active || !Array.isArray(data)) return;
        // Mostra subito la prima pagina, poi il resto a raffiche per non bloccare lo scroll.
        const first = data.slice(0, PAGE_SIZE);
        setItems(first);
        setLoadingTrails(false);
        if (data.length <= first.length) return;
        let offset = first.length;
        const pump = () => {
          if (!active) return;
          offset = Math.min(data.length, offset + PAGE_SIZE * 2);
          setItems(data.slice(0, offset));
          if (offset < data.length) progressiveTimer = window.setTimeout(pump, 40);
        };
        progressiveTimer = window.setTimeout(pump, 40);
      } finally {
        if (active) setLoadingTrails(false);
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

    return () => { cancelled = true; };
  }, [query]);

  const itemsWithDist = useMemo(() => {
    if (!myPos) return items.map((tr) => ({ ...tr, _myDist: Number.POSITIVE_INFINITY }));
    return items.map((tr) => {
      if (tr.start_lat == null || tr.start_lon == null) {
        return { ...tr, _myDist: Number.POSITIVE_INFINITY };
      }
      return { ...tr, _myDist: distanceMeters(myPos, [Number(tr.start_lat), Number(tr.start_lon)]) };
    });
  }, [items, myPos]);

  const results = useMemo(() => {
    const trimmed = query.trim().toLowerCase();

    if (geoResult) {
      const geoPos = [geoResult.lat, geoResult.lon];
      return itemsWithDist
        .map((trail) => {
          if (trail.start_lat == null || trail.start_lon == null) {
            return { ...trail, _geoDist: Number.POSITIVE_INFINITY };
          }
          return {
            ...trail,
            _geoDist: distanceMeters(geoPos, [Number(trail.start_lat), Number(trail.start_lon)]),
          };
        })
        .filter((trail) => trail._geoDist <= GEO_RADIUS_KM * 1000)
        .sort((a, b) => a._geoDist - b._geoDist);
    }

    if (trimmed) {
      const matches = itemsWithDist.filter((trail) => trail.name?.toLowerCase().includes(trimmed));
      if (matches.length > 0) {
        return [...matches].sort((a, b) => a._myDist - b._myDist);
      }
    }

    return [...itemsWithDist].sort((a, b) => a._myDist - b._myDist);
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
                noWrap
                sx={{ display: "inline-flex", alignItems: "center", gap: 0.3, minWidth: 0 }}
              >
                <SignalCellularAltIcon sx={{ fontSize: 14, flexShrink: 0 }} />
                <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {trail.difficulty}
                </Box>
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
              {loadingTrails
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
                onDelete={() => { setGeoResult(null); setQuery(""); }}
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

          <Box sx={cardGridSx}>
            {visible.map((trail) => renderTrailCard(trail))}
          </Box>

          {visible.length === 0 && items.length > 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 3 }}>
              {t(lang, "noTrailsYet")}
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
