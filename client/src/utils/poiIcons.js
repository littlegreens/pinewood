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
  historic: {
    keys: ["historic", "storico", "archeolog", "ruins", "ruderi", "castle", "castello"],
    color: "#8D6E63",
    src: "/poi-historic.svg",
    labelIt: "Storico",
    labelEn: "Historic",
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

function badgeHtml(typeId, { size = 32, img = 18 } = {}) {
  const meta = POI_TYPES[typeId];
  if (!meta) return "";
  return `<div class="pinewood-poi-badge" style="width:${size}px;height:${size}px;--poi-color:${meta.color}"><img src="${meta.src}" alt="" width="${img}" height="${img}"/></div>`;
}

export function poiLeafletIcon(typeId) {
  const meta = POI_TYPES[typeId];
  if (!meta) return null;
  if (iconCache.has(typeId)) return iconCache.get(typeId);
  const icon = L.divIcon({
    className: "pinewood-poi-icon",
    html: badgeHtml(typeId),
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
  iconCache.set(typeId, icon);
  return icon;
}

export function poiStackLeafletIcon(typeIds = []) {
  const ids = typeIds.filter((id) => POI_TYPES[id]);
  if (ids.length === 0) return null;
  if (ids.length === 1) return poiLeafletIcon(ids[0]);
  const dots = ids
    .slice(0, 4)
    .map((id, i) => {
      const ang = (Math.PI * 2 * i) / ids.length - Math.PI / 2;
      const x = 16 + Math.cos(ang) * 7;
      const y = 16 + Math.sin(ang) * 7;
      return `<span style="position:absolute;left:${x - 5}px;top:${y - 5}px;width:10px;height:10px;border-radius:50%;background:${POI_TYPES[id].color};border:1.5px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.25)"></span>`;
    })
    .join("");
  return L.divIcon({
    className: "pinewood-poi-icon pinewood-poi-stack",
    html: `<div class="pinewood-poi-badge pinewood-poi-badge--stack" style="width:34px;height:34px">${dots}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -16],
  });
}

/** HTML badge per MapLibre DOM marker. */
export function poiDomBadgeHtml(typeId) {
  return badgeHtml(typeId, { size: 32, img: 18 });
}

export function poiStackDomBadgeHtml(typeIds = []) {
  const ids = typeIds.filter((id) => POI_TYPES[id]);
  if (ids.length <= 1) return poiDomBadgeHtml(ids[0]);
  const dots = ids
    .slice(0, 4)
    .map((id, i) => {
      const ang = (Math.PI * 2 * i) / ids.length - Math.PI / 2;
      const x = 17 + Math.cos(ang) * 7;
      const y = 17 + Math.sin(ang) * 7;
      return `<span style="position:absolute;left:${x - 5}px;top:${y - 5}px;width:10px;height:10px;border-radius:50%;background:${POI_TYPES[id].color};border:1.5px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.25)"></span>`;
    })
    .join("");
  return `<div class="pinewood-poi-badge pinewood-poi-badge--stack" style="width:34px;height:34px;position:relative">${dots}</div>`;
}

export function waypointLatLng(wp) {
  const c = wp?.geom_geojson?.coordinates;
  if (!Array.isArray(c) || c.length < 2) return null;
  const lon = Number(c[0]);
  const lat = Number(c[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return [lat, lon];
}

export function normalizeWaypoint(wp) {
  const typeId = normalizePoiType(wp?.type) || normalizePoiType(wp?.label);
  const pos = waypointLatLng(wp);
  if (!typeId || !pos) return null;
  return {
    id: wp.id || `${typeId}-${pos[0]}-${pos[1]}`,
    type: typeId,
    label: wp.label || "",
    lat: pos[0],
    lon: pos[1],
    distance_from_start_m: wp.distance_from_start_m,
  };
}
