import { useEffect } from "react";
import { Box, Typography } from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";

const VARIANTS = {
  success: {
    border: "#2e7d32",
    bg: "#edf7ed",
    color: "#1b5e20",
    Icon: CheckCircleOutlineIcon,
    iconColor: "#2e7d32",
  },
  error: {
    border: "#c62828",
    bg: "#fdecea",
    color: "#b71c1c",
    Icon: ErrorOutlineIcon,
    iconColor: "#c62828",
  },
  warning: {
    border: "#ed6c02",
    bg: "#fff4e5",
    color: "#663c00",
    Icon: WarningAmberRoundedIcon,
    iconColor: "#ed6c02",
  },
};

/** Banner con bordo sinistro + icona (stile alert Bootstrap). */
export default function AppBanner({
  message,
  type = "success",
  onDismiss,
  durationMs = 3000,
  top = "max(72px, calc(env(safe-area-inset-top) + 56px))",
  sx,
}) {
  useEffect(() => {
    if (!message || durationMs == null || durationMs <= 0) return undefined;
    const id = window.setTimeout(() => onDismiss?.(), durationMs);
    return () => window.clearTimeout(id);
  }, [message, durationMs, onDismiss]);

  if (!message) return null;

  const v = VARIANTS[type] || VARIANTS.success;
  const Icon = v.Icon;

  return (
    <Box
      sx={{
        position: "fixed",
        top,
        left: 14,
        right: 14,
        zIndex: 3000,
        mx: "auto",
        maxWidth: 520,
        display: "flex",
        alignItems: "stretch",
        gap: 1.2,
        px: 1.75,
        py: 1.35,
        borderRadius: "8px",
        borderLeft: `4px solid ${v.border}`,
        bgcolor: v.bg,
        color: v.color,
        boxShadow: "0 4px 18px rgba(0,0,0,0.14)",
        pointerEvents: "none",
        ...sx,
      }}
    >
      <Icon sx={{ fontSize: 22, color: v.iconColor, flexShrink: 0, mt: 0.15 }} />
      <Typography sx={{ fontWeight: 600, fontSize: "0.92rem", lineHeight: 1.35, flex: 1 }}>
        {message}
      </Typography>
    </Box>
  );
}
