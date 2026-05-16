import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { CheckCircleIcon, ErrorOutlineIcon, WarningIcon } from "./SvgIcons";
import { fonts } from "../theme";

const STYLES = {
  success: {
    border: "#2e7d32",
    bg: "#edf7ed",
    text: "#1b5e20",
    Icon: CheckCircleIcon,
    iconColor: "#2e7d32",
  },
  error: {
    border: "#c62828",
    bg: "#fdecea",
    text: "#b71c1c",
    Icon: ErrorOutlineIcon,
    iconColor: "#c62828",
  },
  warning: {
    border: "#ed6c02",
    bg: "#fff4e5",
    text: "#663c00",
    Icon: WarningIcon,
    iconColor: "#ed6c02",
  },
};

/**
 * Banner stile Bootstrap: bordo sinistro, icona, messaggio.
 * durationMs: auto-chiusura (default 3s). Se 0 o null, resta visibile finché message è valorizzato.
 */
export default function AppBanner({
  message,
  type = "success",
  onDismiss,
  durationMs = 3000,
  topOffset = 72,
}) {
  useEffect(() => {
    if (!message || durationMs == null || durationMs <= 0) return undefined;
    const id = setTimeout(() => onDismiss?.(), durationMs);
    return () => clearTimeout(id);
  }, [message, durationMs, onDismiss]);

  if (!message) return null;

  const cfg = STYLES[type] || STYLES.success;
  const Icon = cfg.Icon;

  return (
    <View style={[styles.wrap, { paddingTop: topOffset }]} pointerEvents="none">
      <View style={[styles.banner, { backgroundColor: cfg.bg, borderLeftColor: cfg.border }]}>
        <Icon size={22} color={cfg.iconColor} />
        <Text style={[styles.text, { color: cfg.text }]}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
    elevation: 10000,
    alignItems: "center",
    paddingHorizontal: 14,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: "100%",
    maxWidth: 480,
    borderLeftWidth: 4,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 6,
  },
  text: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
  },
});
