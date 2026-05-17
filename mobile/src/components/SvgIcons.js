import React from "react";
import { Image, View } from "react-native";
import Svg, { Path, Circle, Text as SvgText } from "react-native-svg";

const LOGO_ASPECT = 270 / 1024;
const LOGO_DARK = require("../../assets/logo-wordmark-dark.png");
const LOGO_WHITE = require("../../assets/logo-wordmark-white.png");

/** Wordmark PNG ufficiale — `resizeMode: contain` per non tagliare. */
export function PinewoodLogo({ width = 160, color = "#1d1d1b" }) {
  const height = width * LOGO_ASPECT;
  const c = String(color || "").trim().toLowerCase();
  const useWhite = c === "#fff" || c === "#ffffff" || c === "white";
  return (
    <View style={{ width, height, justifyContent: "center", alignItems: "center" }}>
      <Image
        source={useWhite ? LOGO_WHITE : LOGO_DARK}
        style={{ width, height }}
        resizeMode="contain"
        accessibilityLabel="Pinewood"
      />
    </View>
  );
}

/* ??? Navigation / Menu ??? */

export function FilterHdrIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M14 6l-3.75 5 2.85 3.8-1.6 1.2C9.81 13.75 7 10 7 10l-6 8h22L14 6z" />
    </Svg>
  );
}

export function HikingIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2m4 5.28c-1.23-.37-2.22-1.17-2.8-2.18l-1-1.6c-.41-.65-1.11-1-1.84-1-.78 0-1.59.5-1.78 1.44S7 23 7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3c1 1.15 2.41 2.01 4 2.34V23H19V9h-1.5z" />
      <Path d="M7.43 13.13l-2.12-.41c-.54-.11-.9-.63-.79-1.17l.76-3.93c.21-1.08 1.26-1.79 2.34-1.58l1.16.23z" />
    </Svg>
  );
}

export function ExploreIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 10.9c-.61 0-1.1.49-1.1 1.1s.49 1.1 1.1 1.1c.61 0 1.1-.49 1.1-1.1s-.49-1.1-1.1-1.1zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm2.19 12.19L6 18l3.81-8.19L18 6l-3.81 8.19z" />
    </Svg>
  );
}

export function FavoriteBorderIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z" />
    </Svg>
  );
}

export function AccountCircleIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-4.43-.82-6.14-2.88C7.55 15.8 9.68 15 12 15s4.45.8 6.14 2.12C16.43 19.18 14.03 20 12 20z" />
    </Svg>
  );
}

export function LoginIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M11 7L9.6 8.4l2.6 2.6H2v2h10.2l-2.6 2.6L11 17l5-5-5-5zm9 12h-8v2h8c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-8v2h8v14z" />
    </Svg>
  );
}

export function MoreVertIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
    </Svg>
  );
}

export function DeleteOutlineIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM8 9h8v10H8V9zm7.5-5-1-1h-5l-1 1H5v2h14V4z" />
    </Svg>
  );
}

export function CloudUploadIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z" />
    </Svg>
  );
}

export function AddIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
    </Svg>
  );
}

export function PublicIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
    </Svg>
  );
}

export function LockOutlineIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
    </Svg>
  );
}

export function ParkingIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M13 3H6v18h4v-6h3c3.31 0 6-2.69 6-6s-2.69-6-6-6zm.2 8H10V7h3.2c1.1 0 2 .9 2 2s-.9 2-2 2z" />
    </Svg>
  );
}

export function EditIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
    </Svg>
  );
}

export function LogoutIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5-5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
    </Svg>
  );
}

export function MenuPanelIcon({ size = 24, color = "#1f1f1f" }) {
  return (
    <Svg width={size} height={size} viewBox="0 -960 960 960" fill={color}>
      <Path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H160Zm240-80h400v-480H400v480Zm-80 0v-480H160v480h160Zm-160 0v-480 480Zm160 0h80-80Zm0-480h80-80Z" />
    </Svg>
  );
}

/* ??? General purpose icons (Material Design) ??? */

export function SearchIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
    </Svg>
  );
}

export function CloseIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
    </Svg>
  );
}

export function CancelIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z" />
    </Svg>
  );
}

export function AccessTimeIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
    </Svg>
  );
}

export function SignalCellularAltIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M17 4h3v16h-3V4zM5 14h3v6H5v-6zm6-5h3v11h-3V9z" />
    </Svg>
  );
}

export function LocationOnIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
    </Svg>
  );
}

export function CheckCircleIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
    </Svg>
  );
}

export function ErrorOutlineIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M11 15h2v2h-2zm0-8h2v6h-2zm.99-5C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" />
    </Svg>
  );
}

export function KeyboardArrowDownIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
    </Svg>
  );
}

export function PersonIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </Svg>
  );
}

export function MapIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z" />
    </Svg>
  );
}

export const SAVE_STAR_COLOR = "#E2B93B";

export function StarBorderIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="m19.65 9.04-4.84-.42-1.89-4.45c-.34-.81-1.5-.81-1.84 0L9.19 8.63l-4.83.41c-.88.07-1.24 1.17-.57 1.75l3.67 3.18-1.1 4.72c-.2.86.73 1.54 1.49 1.08l4.15-2.5 4.15 2.51c.76.46 1.69-.22 1.49-1.08l-1.1-4.73 3.67-3.18c.67-.58.32-1.68-.56-1.75M12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28z" />
    </Svg>
  );
}

export function StarFilledIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
    </Svg>
  );
}

/** Stellina salva trail — come BookmarkPinewoodIcon sulla PWA */
export function SaveTrailStarIcon({ size = 24, filled = false, color = SAVE_STAR_COLOR }) {
  if (filled) {
    return <StarFilledIcon size={size} color={color} />;
  }
  return <StarBorderIcon size={size} color={color} />;
}

/** Avatar Pinewood di default (avatar.svg PWA) */
export function PinewoodAvatarIcon({ size = 24 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 218.78 218.78">
      <Circle
        cx="109.39"
        cy="109.39"
        r="108.89"
        fill="#fff"
        stroke="#1d1d1b"
        strokeWidth={3}
      />
      <Path
        fill="#fff"
        stroke="#1d1d1b"
        strokeWidth={1}
        d="M114.14,173.82h-10.74v-23.75c-14.04,2.89-27.05,5.58-40.27,8.47-.21-.21-.62-.62-.83-1.03,8.05-10.33,15.9-20.65,24.58-31.8-7.02,1.24-12.8,2.48-19.41,3.72,9.09-14.87,17.76-28.91,26.43-42.96l-.62-.83-12.8,5.99c-.21,0-.41-.41-.62-.62,9.5-15.08,18.79-30.15,28.91-46.05,9.91,15.7,19.41,30.77,29.12,46.05,0,.21-.21.41-.41.62-4.34-2.07-8.67-4.13-13.22-6.2-.21.21-.41.41-.62.62,8.67,14.04,17.35,28.29,26.64,43.16-6.82-1.24-12.6-2.48-19.62-3.92,8.88,11.36,16.93,21.68,25.81,33.25-14.46-3.1-27.88-5.78-42.13-8.88v23.75h0l-.21.41Z"
      />
    </Svg>
  );
}

export function MyLocationIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" />
    </Svg>
  );
}

/* ??? TrailDetail specific icons ??? */

export function StraightenIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 10H3V8h2v4h2V8h2v4h2V8h2v4h2V8h2v4h2V8h2v8z" />
    </Svg>
  );
}

export function SpeedIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="m20.38 8.57-1.23 1.85a8 8 0 0 1-.22 7.58H5.07A8 8 0 0 1 15.58 6.85l1.85-1.23A10 10 0 0 0 3.35 19a2 2 0 0 0 1.72 1h13.85a2 2 0 0 0 1.74-1 10 10 0 0 0-.27-10.44zm-9.79 6.84a2 2 0 0 0 2.83 0l5.66-8.49-8.49 5.66a2 2 0 0 0 0 2.83z" />
    </Svg>
  );
}

export function TrendingUpIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="m16 6 2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z" />
    </Svg>
  );
}

export function TrendingDownIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="m16 18 2.29-2.29-4.88-4.88-4 4L2 7.41 3.41 6l6 6 4-4 6.3 6.29L22 12v6z" />
    </Svg>
  );
}

export function RouteIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M19 15.18V7c0-2.21-1.79-4-4-4s-4 1.79-4 4v10c0 1.1-.9 2-2 2s-2-.9-2-2V8.82C8.16 8.4 9 7.3 9 6c0-1.66-1.34-3-3-3S3 4.34 3 6c0 1.3.84 2.4 2 2.82V17c0 2.21 1.79 4 4 4s4-1.79 4-4V7c0-1.1.9-2 2-2s2 .9 2 2v8.18c-1.16.41-2 1.51-2 2.82 0 1.66 1.34 3 3 3s3-1.34 3-3c0-1.3-.84-2.4-2-2.82z" />
    </Svg>
  );
}

export function CloudDownloadIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96M17 13l-5 5-5-5h3V9h4v4h3z" />
    </Svg>
  );
}

export function FileDownloadIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
    </Svg>
  );
}

export function PlayArrowIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M8 5v14l11-7z" />
    </Svg>
  );
}

export function BookmarkIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z" />
    </Svg>
  );
}

export function BookmarkBorderIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15l-5-2.18L7 18V5h10v13z" />
    </Svg>
  );
}

export function FullscreenIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
    </Svg>
  );
}

export function FullscreenExitIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
    </Svg>
  );
}

/** Icone mappa scheda trail (come PWA: zoom_out_map / zoom_in_map) */
export function ZoomOutMapIcon({ size = 20, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 -960 960 960" fill={color}>
      <Path d="M120-120v-240h80v104l124-124 56 56-124 124h104v80H120Zm480 0v-80h104L580-324l56-56 124 124v-104h80v240H600ZM324-580 200-704v104h-80v-240h240v80H256l124 124-56 56Zm312 0-56-56 124-124H600v-80h240v240h-80v-104L636-580Z" />
    </Svg>
  );
}

export function ZoomInMapIcon({ size = 20, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 -960 960 960" fill={color}>
      <Path d="m156-100-56-56 124-124H120v-80h240v240h-80v-104L156-100Zm648 0L680-224v104h-80v-240h240v80H736l124 124-56 56ZM120-600v-80h104L100-804l56-56 124 124v-104h80v240H120Zm480 0v-240h80v104l124-124 56 56-124 124h104v80H600Z" />
    </Svg>
  );
}

/* ─── Marker icona trail (identico a explore.svg della PWA) ─── */
/* ─── Marker icona trail (identico a explore.svg della PWA) ─── */
export function ExploreTrailMarkerIcon({ size = 26 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Circle fill="#fff" cx="10" cy="10.1" r="9.1" />
      <Path
        fill="#2d4f1e"
        d="M5.5,14.5l7-2,2-7-7,2-2,7ZM10,11.5c-.4,0-.8-.1-1.1-.4s-.4-.6-.4-1.1.1-.8.4-1.1c.3-.3.6-.4,1.1-.4s.8.1,1.1.4c.3.3.4.6.4,1.1s-.1.8-.4,1.1c-.3.3-.6.4-1.1.4ZM10,20c-1.4,0-2.7-.3-3.9-.8s-2.3-1.2-3.2-2.1-1.6-2-2.1-3.2-.8-2.5-.8-3.9.3-2.7.8-3.9,1.2-2.3,2.1-3.2,2-1.6,3.2-2.1,2.5-.8,3.9-.8,2.7.3,3.9.8,2.3,1.2,3.2,2.1,1.6,2,2.1,3.2.8,2.5.8,3.9-.3,2.7-.8,3.9-1.2,2.3-2.1,3.2-2,1.6-3.2,2.1-2.5.8-3.9.8ZM10,18c2.2,0,4.1-.8,5.7-2.3s2.3-3.4,2.3-5.7-.8-4.1-2.3-5.7-3.4-2.3-5.7-2.3-4.1.8-5.7,2.3-2.3,3.4-2.3,5.7.8,4.1,2.3,5.7,3.4,2.3,5.7,2.3Z"
      />
    </Svg>
  );
}

/* ─── Cluster icon per la mappa ─── */
export function ClusterMarkerIcon({ count, size = 36 }) {
  const fontSize = count >= 100 ? 11 : count >= 10 ? 12 : 14;
  const half = size / 2;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={half} cy={half} r={half - 1} fill="#2d4f1e" stroke="#fff" strokeWidth="2" />
      <SvgText
        x={half}
        y={half + fontSize * 0.38}
        textAnchor="middle"
        fontSize={fontSize}
        fontWeight="700"
        fill="#fff"
      >
        {count}
      </SvgText>
    </Svg>
  );
}

/* ─── Navigation specific icons ─── */

export function LockIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
    </Svg>
  );
}

export function LockOpenIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h1.9c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm0 12H6V10h12v10z" />
    </Svg>
  );
}

export function WarningIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
    </Svg>
  );
}

export function StopIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M6 6h12v12H6z" />
    </Svg>
  );
}

export function PhoneAndroidIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M16 1H8C6.34 1 5 2.34 5 4v16c0 1.66 1.34 3 3 3h8c1.66 0 3-1.34 3-3V4c0-1.66-1.34-3-3-3zm-2 20h-4v-1h4v1zm3.25-3H6.75V4h10.5v14z" />
    </Svg>
  );
}

/* ??? Weather icons (Material Design) ??? */

export function WbSunnyIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="m6.05 4.14-.39-.39c-.39-.39-1.02-.38-1.4 0l-.01.01c-.39.39-.39 1.02 0 1.4l.39.39c.39.39 1.01.39 1.4 0l.01-.01c.39-.38.39-1.02 0-1.4M3.01 10.5H1.99c-.55 0-.99.44-.99.99v.01c0 .55.44.99.99.99H3c.56.01 1-.43 1-.98v-.01c0-.56-.44-1-.99-1m9-9.95H12c-.56 0-1 .44-1 .99v.96c0 .55.44.99.99.99H12c.56.01 1-.43 1-.98v-.97c0-.55-.44-.99-.99-.99m7.74 3.21c-.39-.39-1.02-.39-1.41-.01l-.39.39c-.39.39-.39 1.02 0 1.4l.01.01c.39.39 1.02.39 1.4 0l.39-.39c.39-.39.39-1.01 0-1.4m-1.81 15.1.39.39c.39.39 1.02.39 1.41 0s.39-1.02 0-1.41l-.39-.39c-.39-.39-1.02-.38-1.4 0-.4.4-.4 1.02-.01 1.41M20 11.49v.01c0 .55.44.99.99.99H22c.55 0 .99-.44.99-.99v-.01c0-.55-.44-.99-.99-.99h-1.01c-.55 0-.99.44-.99.99M12 5.5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6m-.01 16.95H12c.55 0 .99-.44.99-.99v-.96c0-.55-.44-.99-.99-.99h-.01c-.55 0-.99.44-.99.99v.96c0 .55.44.99.99.99m-7.74-3.21c.39.39 1.02.39 1.41 0l.39-.39c.39-.39.38-1.02 0-1.4l-.01-.01a.996.996 0 0 0-1.41 0l-.39.39c-.38.4-.38 1.02.01 1.41" />
    </Svg>
  );
}

export function CloudIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96" />
    </Svg>
  );
}

export function UmbrellaIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="m17.12 6.28-2.62.64L13 5.77V3.4c0-.26.22-.48.5-.48.23 0 .43.16.49.36.11.42.5.72.95.72.55 0 1-.45 1-1 0-.1-.02-.2-.05-.3-.3-.98-1.26-1.7-2.39-1.7C12.12 1 11 2.07 11 3.4v2.37L9.5 6.92l-2.62-.64c-.38-.09-.72.27-.6.64l4.77 14.39c.15.46.55.69.95.69s.8-.23.95-.69l4.77-14.39c.12-.37-.22-.73-.6-.64M11 14.8 9.03 8.86l.92.23.76-.58.29-.22zm2 0V8.29l.28.22.76.58.92-.23z" />
    </Svg>
  );
}

export function AcUnitIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M21 11h-3.17l2.54-2.54c.39-.39.39-1.02 0-1.41s-1.03-.39-1.42 0L15 11h-2V9l3.95-3.95c.39-.39.39-1.03 0-1.42a.996.996 0 0 0-1.41 0L13 6.17V3c0-.55-.45-1-1-1s-1 .45-1 1v3.17L8.46 3.63a.996.996 0 0 0-1.41 0c-.39.39-.39 1.03 0 1.42L11 9v2H9L5.05 7.05c-.39-.39-1.03-.39-1.42 0s-.39 1.02 0 1.41L6.17 11H3c-.55 0-1 .45-1 1s.45 1 1 1h3.17l-2.54 2.54c-.39.39-.39 1.02 0 1.41s1.03.39 1.42 0L9 13h2v2l-3.95 3.95c-.39.39-.39 1.03 0 1.42s1.02.39 1.41 0L11 17.83V21c0 .55.45 1 1 1s1-.45 1-1v-3.17l2.54 2.54c.39.39 1.02.39 1.41 0s.39-1.03 0-1.42L13 15v-2h2l3.95 3.95c.39.39 1.03.39 1.42 0s.39-1.02 0-1.41L17.83 13H21c.55 0 1-.45 1-1s-.45-1-1-1" />
    </Svg>
  );
}

export function ThunderstormIcon({ size = 24, color = "#111" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M17.92 7.02C17.45 4.18 14.97 2 12 2 9.82 2 7.83 3.18 6.78 5.06 4.09 5.41 2 7.74 2 10.5 2 13.53 4.47 16 7.5 16h10c2.48 0 4.5-2.02 4.5-4.5 0-2.34-1.79-4.27-4.08-4.48m-1.97 13.09-.84-.42.9-1.03c.36-.42.32-1.05-.09-1.41-.42-.36-1.05-.32-1.41.09l-1.75 2c-.2.23-.29.55-.23.85s.26.56.53.7l.84.42-.9 1.03c-.36.42-.32 1.05.09 1.41.19.17.42.25.66.25.28 0 .55-.12.75-.34l1.75-2c.2-.23.29-.55.23-.85-.06-.31-.26-.57-.53-.7m-6 0-.85-.43.9-1.03c.36-.42.32-1.05-.09-1.41-.42-.36-1.05-.32-1.41.09l-1.75 2c-.2.23-.29.55-.23.85s.26.56.53.7l.84.42L7 22.34c-.36.42-.32 1.05.09 1.41.19.17.43.25.66.25.28 0 .55-.12.75-.34l1.75-2c.2-.23.29-.55.23-.85-.06-.31-.26-.57-.53-.7" />
    </Svg>
  );
}
