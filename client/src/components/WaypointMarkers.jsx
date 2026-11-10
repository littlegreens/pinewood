import { useEffect, useMemo, useState } from "react";
import { Marker, Popup, useMapEvents } from "react-leaflet";
import { detectLanguage } from "../services/i18n.js";
import {
  normalizeWaypoint,
  poiLeafletIcon,
  poiStackLeafletIcon,
  POI_TYPES,
} from "../utils/poiIcons.js";
import {
  dedupeSameTypeNearby,
  groupNearbyForSpider,
  offsetLatLng,
  spiderOffsets,
} from "../utils/poiLayout.js";

function MapClickCloser({ onClose }) {
  useMapEvents({
    click() {
      onClose?.();
    },
  });
  return null;
}

function SinglePoiMarker({ poi, lang }) {
  const icon = poiLeafletIcon(poi.type);
  if (!icon) return null;
  const meta = POI_TYPES[poi.type];
  const title = poi.label || (lang === "en" ? meta.labelEn : meta.labelIt);
  return (
    <Marker position={[poi.lat, poi.lon]} icon={icon}>
      <Popup closeButton={false} autoClose closeOnClick className="pinewood-poi-popup" offset={[0, -6]}>
        <div className="pinewood-poi-popup__title">{title}</div>
      </Popup>
    </Marker>
  );
}

function SpiderGroup({ group, lang, open, onToggle }) {
  const typeIds = group.members.map((m) => m.type);
  const stackIcon = poiStackLeafletIcon(typeIds);
  const offsets = spiderOffsets(group.members.length);

  if (!open) {
    return (
      <Marker
        position={[group.lat, group.lon]}
        icon={stackIcon}
        eventHandlers={{
          click: (e) => {
            e.originalEvent?.stopPropagation?.();
            onToggle();
          },
        }}
      />
    );
  }

  return (
    <>
      {group.members.map((poi, idx) => {
        const off = offsets[idx] || { n: 0, e: 0 };
        const [lat, lon] = offsetLatLng(group.lat, group.lon, off.n, off.e);
        const icon = poiLeafletIcon(poi.type);
        if (!icon) return null;
        const meta = POI_TYPES[poi.type];
        const title = poi.label || (lang === "en" ? meta.labelEn : meta.labelIt);
        return (
          <Marker key={poi.id} position={[lat, lon]} icon={icon} zIndexOffset={400}>
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
      })}
    </>
  );
}

export default function WaypointMarkers({ waypoints = [] }) {
  const lang = detectLanguage();
  const [openKey, setOpenKey] = useState(null);

  const groups = useMemo(() => {
    const normalized = (waypoints || []).map(normalizeWaypoint).filter(Boolean);
    const deduped = dedupeSameTypeNearby(normalized);
    return groupNearbyForSpider(deduped);
  }, [waypoints]);

  useEffect(() => {
    setOpenKey(null);
  }, [waypoints]);

  if (groups.length === 0) return null;

  return (
    <>
      <MapClickCloser onClose={() => setOpenKey(null)} />
      {groups.map((g) => {
        const key = `${g.lat.toFixed(5)},${g.lon.toFixed(5)}`;
        if (g.members.length === 1) {
          return <SinglePoiMarker key={key} poi={g.members[0]} lang={lang} />;
        }
        return (
          <SpiderGroup
            key={key}
            group={g}
            lang={lang}
            open={openKey === key}
            onToggle={() => setOpenKey((cur) => (cur === key ? null : key))}
          />
        );
      })}
    </>
  );
}
