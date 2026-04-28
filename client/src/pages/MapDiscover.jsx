import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Button, IconButton, InputAdornment, Paper, Stack, TextField, Typography } from "@mui/material";
import MyLocationRoundedIcon from "@mui/icons-material/MyLocationRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import SearchIcon from "@mui/icons-material/Search";
import NorthRoundedIcon from "@mui/icons-material/NorthRounded";
import SouthRoundedIcon from "@mui/icons-material/SouthRounded";
import L from "leaflet";
import { MapContainer, Polyline, TileLayer, useMap } from "react-leaflet";
import { useNavigate } from "react-router-dom";
import InternalHeader from "../components/InternalHeader.jsx";
import { apiFetch } from "../services/api.js";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

const INITIAL_CENTER = [42.7, 12.6];
const INITIAL_ZOOM = 10;
const MAP_OVERLAY_ZINDEX = 1200;
const API = import.meta.env.VITE_API_URL || "";

function FitAllPoints({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!Array.isArray(points) || points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lon], 13, { animate: false });
      return;
    }
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lon]));
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 13, animate: false });
  }, [map, points]);
  return null;
}

function ClusterLayer({ points, onRevealTrail, onClusterClickStart }) {
  const map = useMap();
  const clusterLayerRef = useRef(null);
  const onRevealTrailRef = useRef(onRevealTrail);

  useEffect(() => {
    onRevealTrailRef.current = onRevealTrail;
  }, [onRevealTrail]);

  useEffect(() => {
    const group = L.markerClusterGroup({
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      removeOutsideVisibleBounds: true,
      maxClusterRadius: 52,
      iconCreateFunction(cluster) {
        return L.divIcon({
          className: "pinewood-cluster-icon",
          html: `<div style="width:36px;height:36px;border-radius:50%;background:#2d4f1e;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.88rem;border:2px solid #ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.28);">${cluster.getChildCount()}</div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });
      },
    });
    group.on("clusterclick", (event) => {
      onClusterClickStart?.();
    });
    clusterLayerRef.current = group;
    map.addLayer(group);
    return () => {
      group.off("clusterclick");
      map.removeLayer(group);
      clusterLayerRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    const group = clusterLayerRef.current;
    if (!group) return;
    group.clearLayers();

    for (const trail of points) {
      const marker = L.marker([trail.lat, trail.lon], {
        icon: L.divIcon({
          className: "pinewood-point-icon",
          html: `<img src="/explore.svg" alt="" style="width:26px;height:26px;display:block;filter:drop-shadow(0 2px 8px rgba(0,0,0,0.25));" />`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        }),
      });
      marker.on("click", () => {
        onRevealTrailRef.current?.(trail, map);
      });
      group.addLayer(marker);
    }
  }, [map, points]);

  return null;
}

function LocateControl({ onLocate }) {
  const map = useMap();
  useEffect(() => {
    onLocate.current = () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          map.setView([lat, lon], 13, { animate: true });
        },
        () => {}
      );
    };
  }, [map, onLocate]);
  return null;
}

export default function MapDiscover() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]);
  const [notice, setNotice] = useState("");
  const locateAction = useMemo(() => ({ current: null }), []);

  useEffect(() => {
    let active = true;
    async function load() {
      const res = await apiFetch("/api/trails/discover");
      if (!res.ok) {
        if (active) setNotice("Errore caricamento mappa.");
        return;
      }
      const data = await res.json();
      if (!active) return;
      const points = (Array.isArray(data) ? data : [])
        .filter((t) => Number.isFinite(Number(t.start_lat)) && Number.isFinite(Number(t.start_lon)))
        .map((t) => ({
          id: t.id,
          name: t.name,
          distance_km: t.distance_km,
          estimated_time_minutes: t.estimated_time_minutes,
          difficulty: t.difficulty,
          elevation_gain_m: t.elevation_gain_m,
          elevation_loss_m: t.elevation_loss_m,
          max_elevation_m: t.max_elevation_m,
          min_elevation_m: t.min_elevation_m,
          owner_name: t.owner_name,
          owner_avatar_url: t.owner_avatar_url,
          lat: Number(t.start_lat),
          lon: Number(t.start_lon),
        }));
      setItems(points);
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const [selectedTrail, setSelectedTrail] = useState(null);
  const [selectedTrailPath, setSelectedTrailPath] = useState(null);
  const [trailPathLoading, setTrailPathLoading] = useState(false);
  const [trailPathTimedOut, setTrailPathTimedOut] = useState(false);
  const pathCache = useMemo(() => new Map(), []);
  const cardRef = useRef(null);
  const [cardHeight, setCardHeight] = useState(0);
  const pathLoadTimeoutRef = useRef(null);
  const revealSeqRef = useRef(0);

  function toLatLngPath(geojson) {
    if (!geojson || !geojson.type) return null;
    if (geojson.type === "LineString" && Array.isArray(geojson.coordinates)) {
      return geojson.coordinates
        .filter((c) => Array.isArray(c) && Number.isFinite(Number(c[0])) && Number.isFinite(Number(c[1])))
        .map((c) => [Number(c[1]), Number(c[0])]);
    }
    if (geojson.type === "MultiLineString" && Array.isArray(geojson.coordinates)) {
      const merged = geojson.coordinates.flatMap((segment) =>
        Array.isArray(segment)
          ? segment
              .filter((c) => Array.isArray(c) && Number.isFinite(Number(c[0])) && Number.isFinite(Number(c[1])))
              .map((c) => [Number(c[1]), Number(c[0])])
          : []
      );
      return merged.length ? merged : null;
    }
    return null;
  }

  const closeSelections = useCallback(() => {
    revealSeqRef.current += 1;
    if (pathLoadTimeoutRef.current != null) {
      clearTimeout(pathLoadTimeoutRef.current);
      pathLoadTimeoutRef.current = null;
    }
    setTrailPathLoading(false);
    setTrailPathTimedOut(false);
    setSelectedTrail(null);
    setSelectedTrailPath(null);
  }, []);

  const revealTrailOnMap = useCallback(async (trail, mapInstance) => {
    if (selectedTrail?.id === trail.id && selectedTrailPath?.length) {
      return;
    }
    function focusMarkerFallback() {
      if (!mapInstance) return;
      mapInstance.stop();
      mapInstance.flyTo([trail.lat, trail.lon], 14, {
        animate: true,
        duration: 0.35,
      });
    }

    function focusTrailPath(path) {
      if (!mapInstance || !Array.isArray(path) || path.length < 2) return;
      const validPath = path.filter(
        (pt) => Array.isArray(pt) && pt.length === 2 && Number.isFinite(pt[0]) && Number.isFinite(pt[1])
      );
      if (validPath.length < 2) return;
      const bounds = L.latLngBounds(validPath);
      if (!bounds.isValid()) return;
      const bottomPad = Math.max(180, Math.round(cardHeight + 26));
      mapInstance.stop();
      mapInstance.flyToBounds(bounds, {
        paddingTopLeft: [26, 26],
        paddingBottomRight: [26, bottomPad],
        maxZoom: 15,
        animate: true,
        duration: 0.45,
      });
    }

    const runReveal = async () => {
      const revealSeq = revealSeqRef.current + 1;
      revealSeqRef.current = revealSeq;
      if (pathLoadTimeoutRef.current != null) {
        clearTimeout(pathLoadTimeoutRef.current);
        pathLoadTimeoutRef.current = null;
      }
      setSelectedTrail(trail);
      setSelectedTrailPath(null);
      setTrailPathLoading(true);
      setTrailPathTimedOut(false);
      if (pathCache.has(trail.id)) {
        const cached = pathCache.get(trail.id);
        if (revealSeqRef.current !== revealSeq) return;
        if (pathLoadTimeoutRef.current != null) {
          clearTimeout(pathLoadTimeoutRef.current);
          pathLoadTimeoutRef.current = null;
        }
        setTrailPathLoading(false);
        setTrailPathTimedOut(false);
        setSelectedTrailPath(cached);
        focusTrailPath(cached);
        return;
      }
      pathLoadTimeoutRef.current = window.setTimeout(() => {
        if (revealSeqRef.current !== revealSeq) return;
        setTrailPathTimedOut(true);
        focusMarkerFallback();
      }, 3000);
      const res = await apiFetch(`/api/trails/${trail.id}`);
      if (revealSeqRef.current !== revealSeq) return;
      if (pathLoadTimeoutRef.current != null) {
        clearTimeout(pathLoadTimeoutRef.current);
        pathLoadTimeoutRef.current = null;
      }
      if (!res.ok) {
        setTrailPathLoading(false);
        setTrailPathTimedOut(false);
        setNotice("Non riesco a caricare il percorso adesso.");
        return;
      }
      const detail = await res.json();
      if (revealSeqRef.current !== revealSeq) return;
      const path = toLatLngPath(detail.geom_geojson);
      if (!path || path.length < 2) {
        setTrailPathLoading(false);
        setTrailPathTimedOut(false);
        setNotice("Tracciato non disponibile per questo percorso.");
        return;
      }
      pathCache.set(trail.id, path);
      setTrailPathLoading(false);
      setTrailPathTimedOut(false);
      setSelectedTrailPath(path);
      focusTrailPath(path);
    };
    await runReveal();
  }, [cardHeight, pathCache, selectedTrail?.id, selectedTrailPath]);

  function formatMinutesToHours(minutes) {
    if (!Number.isFinite(Number(minutes))) return null;
    const total = Number(minutes);
    const h = Math.floor(total / 60);
    const m = Math.round(total % 60);
    if (h <= 0) return `${m} min`;
    return `${h} h ${m} min`;
  }

  function formatMeters(value) {
    if (!Number.isFinite(Number(value))) return "N/D";
    return `${Math.round(Number(value))} m`;
  }

  const filteredPoints = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p) => String(p.name || "").toLowerCase().includes(q));
  }, [items, query]);

  useEffect(() => {
    if (!selectedTrail || !cardRef.current) return;
    const node = cardRef.current;
    const update = () => setCardHeight(node.getBoundingClientRect().height || 0);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return () => ro.disconnect();
  }, [selectedTrail]);

  return (
    <Box sx={{ height: "100dvh", display: "flex", flexDirection: "column", bgcolor: "background.default" }}>
      <InternalHeader />
      <Box sx={{ position: "relative", flex: 1, minHeight: 0 }}>
        <MapContainer center={INITIAL_CENTER} zoom={INITIAL_ZOOM} style={{ width: "100%", height: "100%" }} zoomControl={false}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocateControl onLocate={locateAction} />
          <FitAllPoints points={items} />
          <ClusterLayer
            points={filteredPoints}
            onRevealTrail={revealTrailOnMap}
            onClusterClickStart={closeSelections}
          />
          {selectedTrailPath && selectedTrailPath.length >= 2 && (
            <Polyline
              positions={selectedTrailPath}
              pathOptions={{ color: "#2d4f1e", weight: 5, opacity: 0.9, lineCap: "round", lineJoin: "round" }}
            />
          )}
        </MapContainer>
        <Box
          sx={{
            position: "absolute",
            top: 10,
            left: 10,
            right: 10,
            zIndex: MAP_OVERLAY_ZINDEX,
            pointerEvents: "none",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, pointerEvents: "auto" }}>
            <TextField
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={closeSelections}
              onClick={closeSelections}
              placeholder="Cerca percorso"
              fullWidth
              size="small"
              sx={{
                "& .MuiOutlinedInput-root": {
                  bgcolor: "#ffffffef",
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "#d1d5db",
                  },
                  "&:hover .MuiOutlinedInput-notchedOutline": {
                    borderColor: "#d1d5db",
                  },
                  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                    borderColor: "#d1d5db",
                    borderWidth: 1,
                  },
                },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            <IconButton
              aria-label="Centra su di me"
              onClick={() => locateAction.current?.()}
              sx={{ border: "1px solid #e5e7eb", borderRadius: 1.5, bgcolor: "#ffffffef" }}
            >
              <MyLocationRoundedIcon />
            </IconButton>
          </Box>
          {notice && (
            <Alert severity="error" sx={{ mt: 0.8, pointerEvents: "auto" }}>
              {notice}
            </Alert>
          )}
        </Box>
        {selectedTrail && (
          <Box
            sx={{
              position: "absolute",
              left: 10,
              right: 10,
              bottom: 12,
              zIndex: MAP_OVERLAY_ZINDEX,
              pointerEvents: "none",
            }}
          >
            <Paper
              ref={cardRef}
              elevation={6}
              sx={{
                borderRadius: 2.4,
                overflow: "hidden",
                pointerEvents: "auto",
                border: "1px solid #d9dee4",
              }}
            >
              <Box sx={{ position: "relative" }}>
                <IconButton
                  onClick={closeSelections}
                  sx={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    bgcolor: "transparent",
                    "&:hover": { bgcolor: "transparent" },
                  }}
                >
                  <CloseRoundedIcon sx={{ fontSize: 24 }} />
                </IconButton>
              </Box>
              <Box sx={{ p: "18px" }}>
                <Typography sx={{ fontWeight: 800, fontSize: "1rem", lineHeight: 1.2, mb: 0.8, pr: 4.5 }}>
                  {selectedTrail.name}
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 0.8, mb: 1.05 }}>
                  {selectedTrail.distance_km != null && (
                    <Typography variant="body2" color="text.secondary">
                      {Number(selectedTrail.distance_km).toFixed(2).replace(".", ",")} km
                    </Typography>
                  )}
                  {selectedTrail.estimated_time_minutes != null && (
                    <Typography variant="body2" color="text.secondary">
                      | {formatMinutesToHours(selectedTrail.estimated_time_minutes)}
                    </Typography>
                  )}
                  {(selectedTrail.elevation_gain_m != null || selectedTrail.elevation_loss_m != null) && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ display: "inline-flex", alignItems: "center", gap: 0.2 }}
                    >
                      | <NorthRoundedIcon sx={{ fontSize: 15 }} />
                      {selectedTrail.elevation_gain_m ?? "-"}m
                      <SouthRoundedIcon sx={{ fontSize: 15, ml: 0.2 }} />
                      {selectedTrail.elevation_loss_m ?? selectedTrail.elevation_gain_m ?? "-"}m
                    </Typography>
                  )}
                  {selectedTrail.difficulty && (
                    <Typography variant="body2" color="text.secondary">
                      | {selectedTrail.difficulty}
                    </Typography>
                  )}
                </Box>
                {trailPathLoading && trailPathTimedOut && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                    Caricamento traccia...
                  </Typography>
                )}
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.7 }}>
                    <Box
                      component="img"
                      src={selectedTrail.owner_avatar_url ? `${API}${selectedTrail.owner_avatar_url}` : "/avatar.svg"}
                      alt={selectedTrail.owner_name || "Pinewood"}
                      sx={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover", bgcolor: "#fff" }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      Caricato da {selectedTrail.owner_name || "Pinewood"}
                    </Typography>
                  </Box>
                  <Button
                    variant="contained"
                    onClick={() =>
                      navigate(`/app/trails/${selectedTrail.id}`, {
                        state: { backTo: "/app/map" },
                      })
                    }
                    sx={{ bgcolor: "#2d4f1e", fontWeight: 700, px: 2.2, "&:hover": { bgcolor: "#244016" } }}
                  >
                    Apri scheda
                  </Button>
                </Box>
              </Box>
            </Paper>
          </Box>
        )}
      </Box>
    </Box>
  );
}
