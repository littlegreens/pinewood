import React from "react";
import { Platform } from "react-native";
import MapView, { UrlTile, PROVIDER_DEFAULT } from "react-native-maps";

const TILE_URL = "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png";

const OSMMap = React.forwardRef(({ children, style, ...props }, ref) => {
  return (
    <MapView
      ref={ref}
      provider={PROVIDER_DEFAULT}
      mapType={Platform.OS === "android" ? "none" : "standard"}
      style={style}
      rotateEnabled={false}
      pitchEnabled={false}
      loadingEnabled
      moveOnMarkerPress={false}
      {...props}
    >
      <UrlTile
        urlTemplate={TILE_URL}
        maximumZ={19}
        flipY={false}
        tileSize={256}
      />
      {children}
    </MapView>
  );
});

OSMMap.displayName = "OSMMap";
export default OSMMap;
