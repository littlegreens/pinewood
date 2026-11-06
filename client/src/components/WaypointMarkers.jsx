import { Marker, Popup } from "react-leaflet";
import { detectLanguage } from "../services/i18n.js";
import { normalizePoiType, poiLeafletIcon, POI_TYPES, waypointLatLng } from "../utils/poiIcons.js";

export default function WaypointMarkers({ waypoints = [] }) {
  const lang = detectLanguage();
  if (!Array.isArray(waypoints) || waypoints.length === 0) return null;

  return waypoints.map((wp) => {
    const typeId = normalizePoiType(wp.type) || normalizePoiType(wp.label);
    if (!typeId) return null;
    const icon = poiLeafletIcon(typeId);
    const pos = waypointLatLng(wp);
    if (!icon || !pos) return null;
    const meta = POI_TYPES[typeId];
    const title = wp.label || (lang === "en" ? meta.labelEn : meta.labelIt);
    return (
      <Marker key={wp.id || `${typeId}-${pos[0]}-${pos[1]}`} position={pos} icon={icon}>
        <Popup
          closeButton={false}
          autoClose
          closeOnClick
          className="pinewood-poi-popup"
          offset={[0, -6]}
        >
          <div className="pinewood-poi-popup__title">{title}</div>
        </Popup>
      </Marker>
    );
  });
}
