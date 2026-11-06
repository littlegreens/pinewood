import L from "leaflet";

/** Tipi POI supportati sulle mappe (DB `waypoints.type`). */
export const POI_TYPES = {
  water: {
    keys: ["water", "acqua", "fonte", "spring", "fountain"],
    color: "#1E88E5",
    src: "/poi-water.svg",
    labelIt: "Acqua",
    labelEn: "Water",
  },
  shelter: {
    keys: ["shelter", "rifugio", "bivacco", "hut", "cabin", "bivouac"],
    color: "#EF6C00",
    src: "/poi-shelter.svg",
    labelIt: "Rifugio",
    labelEn: "Shelter",
  },
  viewpoint: {
    keys: ["viewpoint", "belvedere", "panorama", "vista", "peak", "summit"],
    color: "#2E7D32",
    src: "/poi-viewpoint.svg",
    labelIt: "Belvedere",
    labelEn: "Viewpoint",
  },
};

export function normalizePoiType(raw) {
  const s = String(raw || "")
    .trim()
    .toLowerCase();
  if (!s) return null;
  for (const [id, meta] of Object.entries(POI_TYPES)) {
    if (meta.keys.some((k) => s === k || s.includes(k))) return id;
  }
  return null;
}

const iconCache = new Map();

export function poiLeafletIcon(typeId) {
  const meta = POI_TYPES[typeId];
  if (!meta) return null;
  if (iconCache.has(typeId)) return iconCache.get(typeId);
  const icon = L.divIcon({
    className: "pinewood-poi-icon",
    html: `<div style="width:30px;height:30px;border-radius:50%;background:#fff;box-shadow:0 1px 6px rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center;border:1px solid rgba(0,0,0,.08)"><img src="${meta.src}" alt="" width="18" height="18" style="display:block"/></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -14],
  });
  iconCache.set(typeId, icon);
  return icon;
}

export function waypointLatLng(wp) {
  const c = wp?.geom_geojson?.coordinates;
  if (!Array.isArray(c) || c.length < 2) return null;
  const lon = Number(c[0]);
  const lat = Number(c[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return [lat, lon];
}
