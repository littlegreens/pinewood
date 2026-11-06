/** HTML Leaflet ? stesso stack PWA (OSM + MarkerCluster + explore.svg) */
export const LEAFLET_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; }
    .pinewood-point-icon, .pinewood-cluster-icon { background: transparent !important; border: none !important; }
    .leaflet-container { font-family: sans-serif; }
    .leaflet-control-attribution { display: none !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
  <script>
(function () {
  var EXPLORE_ICON = "data:image/svg+xml," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><circle fill="#fff" cx="10" cy="10.1" r="9.1"/><path fill="#2d4f1e" d="M5.5,14.5l7-2,2-7-7,2-2,7ZM10,11.5c-.4,0-.8-.1-1.1-.4s-.4-.6-.4-1.1.1-.8.4-1.1c.3-.3.6-.4,1.1-.4s.8.1,1.1.4c.3.3.4.6.4,1.1s-.1.8-.4,1.1c-.3.3-.6.4-1.1.4ZM10,20c-1.4,0-2.7-.3-3.9-.8s-2.3-1.2-3.2-2.1-1.6-2-2.1-3.2-.8-2.5-.8-3.9.3-2.7.8-3.9,1.2-2.3,2.1-3.2,2-1.6,3.2-2.1,2.5-.8,3.9-.8,2.7.3,3.9.8,2.3,1.2,3.2,2.1,1.6,2,2.1,3.2.8,2.5.8,3.9-.3,2.7-.8,3.9-1.2,2.3-2.1,3.2-2,1.6-3.2,2.1-2.5.8-3.9.8ZM10,18c2.2,0,4.1-.8,5.7-2.3s2.3-3.4,2.3-5.7-.8-4.1-2.3-5.7-3.4-2.3-5.7-2.3-4.1.8-5.7,2.3-2.3,3.4-2.3,5.7.8,4.1,2.3,5.7,3.4,2.3,5.7,2.3Z"/></svg>'
  );

  var map, clusterGroup, pathLayer, trailLayer, actualLayer, reconnectLayer, startMarker, endMarker, userMarker;
  var tileLayer = null;
  var mode = "discover";
  var interactive = true;
  var courseUpEnabled = false;
  var savedDiscoverView = null;
  var DISCOVER_FLY_IN = 0.5;
  var DISCOVER_FLY_OUT = 0.45;
  /** Base file:// per tile OSM scaricate offline (impostata da RN). */
  var offlineTileBase = null;
  var OSM_ONLINE = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  function post(msg) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    }
  }

  function trailIcon() {
    return L.divIcon({
      className: "pinewood-point-icon",
      html: '<img src="' + EXPLORE_ICON + '" alt="" style="width:26px;height:26px;display:block;filter:drop-shadow(0 2px 8px rgba(0,0,0,0.25));" />',
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
  }

  function onlineTileUrl(coords) {
    var s = ["a", "b", "c"][Math.abs(coords.x + coords.y) % 3];
    return OSM_ONLINE
      .replace("{s}", s)
      .replace("{z}", String(coords.z))
      .replace("{x}", String(coords.x))
      .replace("{y}", String(coords.y));
  }

  function localTileUrl(coords) {
    if (!offlineTileBase) return null;
    var base = offlineTileBase.charAt(offlineTileBase.length - 1) === "/"
      ? offlineTileBase
      : offlineTileBase + "/";
    return base + coords.z + "/" + coords.x + "/" + coords.y + ".png";
  }

  function ensureTileLayer() {
    if (!map) return;
    if (tileLayer) {
      map.removeLayer(tileLayer);
      tileLayer = null;
    }
    // Preferisce file locali; se mancano o falliscono, ricade su OSM online.
    tileLayer = L.tileLayer(OSM_ONLINE, {
      maxZoom: 19,
      crossOrigin: true,
      errorTileUrl: "",
    });
    tileLayer.getTileUrl = function (coords) {
      var local = localTileUrl(coords);
      if (local) return local;
      return onlineTileUrl(coords);
    };
    tileLayer.on("tileerror", function (e) {
      try {
        var img = e.tile;
        if (!img || img._pinewoodOnlineFallback) return;
        var coords = e.coords;
        if (!coords) return;
        img._pinewoodOnlineFallback = true;
        img.src = onlineTileUrl(coords);
      } catch (err) { /* ignore */ }
    });
    tileLayer.addTo(map);
  }

  function initMap() {
    map = L.map("map", { zoomControl: false, attributionControl: false }).setView([42.7, 12.6], 10);
    ensureTileLayer();
    map.on("click", function () { post({ type: "mapClick" }); });
    setTimeout(function () { map.invalidateSize(); }, 100);
    post({ type: "ready" });
  }

  /** Rotazione mappa: direzione di marcia verso l'alto (course-up, non nord fisso). */
  function setMapBearing(headingDeg, centerLatLng) {
    if (!map) return;
    var pane = map.getPanes().mapPane;
    if (!pane) return;
    if (!courseUpEnabled || typeof headingDeg !== "number" || isNaN(headingDeg)) {
      pane.style.transform = "";
      pane.style.transformOrigin = "";
      return;
    }
    var pt = centerLatLng
      ? map.latLngToContainerPoint(centerLatLng)
      : map.latLngToContainerPoint(map.getCenter());
    pane.style.transformOrigin = pt.x + "px " + pt.y + "px";
    pane.style.transform = "rotate(" + (-headingDeg) + "deg)";
  }

  function setInteract(on) {
    interactive = on !== false;
    if (!map) return;
    if (interactive) {
      map.dragging.enable();
      map.touchZoom.enable();
      map.doubleClickZoom.enable();
      map.scrollWheelZoom.enable();
    } else {
      map.dragging.disable();
      map.touchZoom.disable();
      map.doubleClickZoom.disable();
      map.scrollWheelZoom.disable();
    }
  }

  function clearPathLayer() {
    if (pathLayer) { map.removeLayer(pathLayer); pathLayer = null; }
  }

  function unspiderfyCluster() {
    if (clusterGroup && typeof clusterGroup.unspiderfy === "function") {
      clusterGroup.unspiderfy();
    }
  }

  function clearPath() {
    clearPathLayer();
    if (savedDiscoverView && mode === "discover") {
      unspiderfyCluster();
      map.stop();
      map.flyTo(
        [savedDiscoverView.lat, savedDiscoverView.lng],
        savedDiscoverView.zoom,
        { animate: true, duration: DISCOVER_FLY_OUT }
      );
      savedDiscoverView = null;
    }
  }

  function clearTrailLayers() {
    clearPath();
    if (trailLayer) { map.removeLayer(trailLayer); trailLayer = null; }
    if (actualLayer) { map.removeLayer(actualLayer); actualLayer = null; }
    if (reconnectLayer) { map.removeLayer(reconnectLayer); reconnectLayer = null; }
    if (startMarker) { map.removeLayer(startMarker); startMarker = null; }
    if (endMarker) { map.removeLayer(endMarker); endMarker = null; }
    if (userMarker) { map.removeLayer(userMarker); userMarker = null; }
  }

  function clearCluster() {
    if (clusterGroup) { map.removeLayer(clusterGroup); clusterGroup = null; }
  }

  function setDiscoverPoints(points) {
    clearCluster();
    if (!Array.isArray(points) || !points.length) return;
    clusterGroup = L.markerClusterGroup({
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      removeOutsideVisibleBounds: true,
      maxClusterRadius: 52,
      animate: false,
      animateAddingMarkers: false,
      iconCreateFunction: function (cluster) {
        return L.divIcon({
          className: "pinewood-cluster-icon",
          html: '<div style="width:36px;height:36px;border-radius:50%;background:#2d4f1e;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.88rem;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.28);">' + cluster.getChildCount() + '</div>',
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });
      },
    });
    points.forEach(function (p) {
      var m = L.marker([p.lat, p.lon], { icon: trailIcon() });
      m.on("click", function (e) {
        L.DomEvent.stopPropagation(e);
        post({ type: "trailClick", trail: p });
      });
      clusterGroup.addLayer(m);
    });
    map.addLayer(clusterGroup);
  }

  function drawPath(latlngs, color, weight) {
    clearPathLayer();
    if (!latlngs || latlngs.length < 2) return null;
    pathLayer = L.polyline(latlngs, {
      color: color || "#2d4f1e",
      weight: weight || 4,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(map);
    return pathLayer;
  }

  /** flyToBounds: animazione fluida anche su grandi distanze (fitBounds pu? ?scattare? in WebView). */
  function fitLatLngs(latlngs, bottomPad) {
    if (!latlngs || latlngs.length < 2) return;
    var bounds = L.latLngBounds(latlngs);
    if (!bounds.isValid()) return;
    map.stop();
    map.flyToBounds(bounds, {
      paddingTopLeft: [26, 26],
      paddingBottomRight: [26, bottomPad || 26],
      maxZoom: 15,
      duration: DISCOVER_FLY_IN,
    });
  }

  function flyToLatLon(lat, lon, zoom) {
    if (lat == null || lon == null) return;
    map.stop();
    map.flyTo([lat, lon], zoom != null ? zoom : 14, { duration: DISCOVER_FLY_IN });
  }

  function fitPoints(points) {
    if (!points || !points.length) return;
    if (points.length === 1) {
      map.setView([points[0][0], points[0][1]], 13, { animate: false });
      return;
    }
    var latlngs = points.map(function (p) {
      return Array.isArray(p) ? [p[0], p[1]] : [p.lat, p.lon];
    });
    var bounds = L.latLngBounds(latlngs);
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 13, animate: false });
  }

  function setTrailDetail(data) {
    clearCluster();
    clearTrailLayers();
    var path = data.path || [];
    if (path.length >= 2) {
      trailLayer = L.polyline(path, { color: "#2D4F1E", weight: 4, lineCap: "round", lineJoin: "round" }).addTo(map);
      pathLayer = trailLayer;
      var start = path[0];
      var end = path[path.length - 1];
      startMarker = L.circleMarker(start, { radius: 8, fillColor: "#4a8c5c", color: "#4a8c5c", weight: 1, fillOpacity: 1 }).addTo(map);
      if (end[0] !== start[0] || end[1] !== start[1]) {
        endMarker = L.circleMarker(end, { radius: 8, fillColor: "#c9a84c", color: "#c9a84c", weight: 1, fillOpacity: 1 }).addTo(map);
      }
      fitLatLngs(path, 40);
    }
    setInteract(data.interactive !== false);
    setTimeout(function () { map.invalidateSize(); }, 150);
  }

  function setNavigation(data) {
    clearCluster();
    clearTrailLayers();
    var trail = data.trailPath || [];
    var actual = data.actualPath || [];
    if (trail.length >= 2) {
      trailLayer = L.polyline(trail, { color: "#2d4f1e", weight: 4 }).addTo(map);
    }
    if (actual.length >= 2) {
      actualLayer = L.polyline(actual, { color: "#c9a84c", weight: 3 }).addTo(map);
    }
    var reconnect = data.reconnectPath || [];
    if (reconnect.length >= 2) {
      reconnectLayer = L.polyline(reconnect, {
        color: "#ff6b00",
        weight: 3,
        dashArray: "10 8",
        opacity: 0.95,
      }).addTo(map);
    }
    courseUpEnabled = Boolean(data.followUser && data.rotateCourseUp !== false);
    var hasHeading = typeof data.heading === "number" && !isNaN(data.heading);
    updateUserMarker(data.userPosition, data.heading);
    if (data.followUser && data.userPosition) {
      if (courseUpEnabled && hasHeading) {
        setMapBearing(data.heading, data.userPosition);
      } else {
        setMapBearing(null);
      }
      map.setView(data.userPosition, Math.max(map.getZoom(), 14), { animate: true });
    } else {
      setMapBearing(null);
      if (trail.length >= 2) fitLatLngs(trail, 80);
    }
    setInteract(true);
  }

  function updateUserMarker(pos, heading) {
    if (userMarker) { map.removeLayer(userMarker); userMarker = null; }
    if (!pos || pos.length < 2) return;
    var hasHeading = typeof heading === "number" && !isNaN(heading);
    if (hasHeading) {
      userMarker = L.marker(pos, {
        icon: L.divIcon({
          className: "pinewood-user-heading",
          html: '<div style="width:30px;height:30px;transform:rotate(' + heading + 'deg);"><svg viewBox="0 0 24 24" width="30" height="30"><polygon points="12,3 21,20 12,15.5 3,20" fill="#e8c85c" stroke="#3a3a3a" stroke-width="1"/></svg></div>',
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        }),
        interactive: false,
      }).addTo(map);
    } else {
      userMarker = L.circleMarker(pos, {
        radius: 7,
        fillColor: "#e8c85c",
        color: "#3a3a3a",
        weight: 2,
        fillOpacity: 1,
      }).addTo(map);
    }
  }

  function handleMessage(raw) {
    var msg;
    try { msg = typeof raw === "string" ? JSON.parse(raw) : raw; } catch (e) { return; }
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case "setMode":
        mode = msg.mode || "discover";
        setInteract(msg.interactive !== false);
        break;
      case "setPoints":
        if (mode === "discover") setDiscoverPoints(msg.points || []);
        break;
      case "setPath":
        if (msg.path && msg.path.length >= 2) {
          if (msg.fit && mode === "discover" && !savedDiscoverView) {
            var c0 = map.getCenter();
            savedDiscoverView = { lat: c0.lat, lng: c0.lng, zoom: map.getZoom() };
          }
          clearPathLayer();
          drawPath(msg.path, msg.color, msg.weight);
          if (msg.fit) fitLatLngs(msg.path, msg.bottomPad);
        } else {
          clearPath();
        }
        break;
      case "clearPath":
        clearPath();
        break;
      case "fitPoints":
        fitPoints(msg.points);
        break;
      case "fitPath":
        if (msg.path) fitLatLngs(msg.path, msg.bottomPad);
        break;
      case "locate":
        flyToLatLon(msg.lat, msg.lon, msg.zoom != null ? msg.zoom : 14);
        break;
      case "setTrail":
        setTrailDetail(msg);
        break;
      case "setNavigation":
        setNavigation(msg);
        break;
      case "setOfflineTiles":
        offlineTileBase = msg.baseUri || null;
        ensureTileLayer();
        break;
      case "invalidate":
        map.invalidateSize();
        break;
      default:
        break;
    }
  }

  window.handleRNMessage = handleMessage;
  document.addEventListener("message", function (e) { handleMessage(e.data); });
  window.addEventListener("message", function (e) { handleMessage(e.data); });

  document.addEventListener("DOMContentLoaded", initMap);
  if (document.readyState === "complete" || document.readyState === "interactive") {
    initMap();
  }
})();
  </script>
</body>
</html>`;
