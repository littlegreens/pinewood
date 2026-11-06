import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Platform, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import * as FileSystem from "expo-file-system/legacy";
import { LEAFLET_HTML } from "./leaflet/leafletHtml";
import { getTilesBaseUri } from "../services/offlineMaps";

const LeafletMap = forwardRef(function LeafletMap(
  {
    style,
    mode = "discover",
    points = [],
    path = null,
    fitBottomPadding = 26,
    interactive = true,
    trailPath = null,
    actualPath = null,
    userPosition = null,
    heading = null,
    reconnectPath = null,
    followUser = false,
    /** Se true, Leaflet prova prima i PNG scaricati in documentDirectory/tiles. */
    useOfflineTiles = false,
    onTrailPress,
    onMapPress,
    onReady,
  },
  ref,
) {
  const webRef = useRef(null);
  const [ready, setReady] = useState(false);
  const tilesDir = FileSystem.documentDirectory || "";

  const post = useCallback(
    (msg) => {
      if (!webRef.current || !ready) return;
      webRef.current.postMessage(JSON.stringify(msg));
    },
    [ready],
  );

  useImperativeHandle(
    ref,
    () => ({
      post,
      locate(lat, lon, zoom = 13) {
        post({ type: "locate", lat, lon, zoom });
      },
      fitPoints(pts) {
        post({ type: "fitPoints", points: pts });
      },
      fitPath(latlngs, bottomPad) {
        post({ type: "fitPath", path: latlngs, bottomPad: bottomPad ?? fitBottomPadding });
      },
      clearPath() {
        post({ type: "clearPath" });
      },
      invalidate() {
        post({ type: "invalidate" });
      },
    }),
    [post, fitBottomPadding],
  );

  useEffect(() => {
    if (!ready) return;
    post({ type: "setMode", mode, interactive });
  }, [ready, mode, interactive, post]);

  useEffect(() => {
    if (!ready || mode !== "discover") return;
    post({ type: "setPoints", points });
  }, [ready, mode, points, post]);

  useEffect(() => {
    if (!ready || mode !== "discover") return;
    if (path && path.length >= 2) {
      post({
        type: "setPath",
        path,
        color: "#2d4f1e",
        weight: 4,
        fit: true,
        bottomPad: fitBottomPadding,
      });
    } else {
      post({ type: "clearPath" });
    }
  }, [ready, mode, path, fitBottomPadding, post]);

  useEffect(() => {
    if (!ready || mode !== "trail") return;
    post({
      type: "setTrail",
      path: trailPath,
      interactive,
    });
  }, [ready, mode, trailPath, interactive, post]);

  useEffect(() => {
    if (!ready || mode !== "navigation") return;
    post({
      type: "setNavigation",
      trailPath,
      actualPath,
      userPosition,
      heading,
      reconnectPath,
      followUser,
      rotateCourseUp: followUser,
    });
  }, [ready, mode, trailPath, actualPath, userPosition, heading, reconnectPath, followUser, post]);

  useEffect(() => {
    if (!ready) return;
    post({
      type: "setOfflineTiles",
      baseUri: useOfflineTiles ? getTilesBaseUri() : null,
    });
  }, [ready, useOfflineTiles, post]);

  const onMessage = useCallback(
    (event) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === "ready") {
          setReady(true);
          onReady?.();
        } else if (data.type === "trailClick") {
          onTrailPress?.(data.trail);
        } else if (data.type === "mapClick") {
          onMapPress?.();
        }
      } catch {
        /* ignore */
      }
    },
    [onTrailPress, onMapPress, onReady],
  );

  return (
    <WebView
      ref={webRef}
      style={[styles.fill, style]}
      source={{
        html: LEAFLET_HTML,
        // baseUrl file:// consente a iOS di caricare i PNG da documentDirectory
        baseUrl: tilesDir || undefined,
      }}
      originWhitelist={["*"]}
      javaScriptEnabled
      domStorageEnabled
      mixedContentMode="always"
      allowsInlineMediaPlayback
      allowFileAccess
      allowUniversalAccessFromFileURLs
      allowingReadAccessToURL={tilesDir || undefined}
      onMessage={onMessage}
      onLoadEnd={() => {
        setTimeout(() => post({ type: "invalidate" }), 200);
      }}
      nestedScrollEnabled
      scrollEnabled={interactive}
      {...(Platform.OS === "android" ? { androidLayerType: "hardware" } : {})}
    />
  );
});

const styles = StyleSheet.create({
  fill: { flex: 1 },
});

export default LeafletMap;
