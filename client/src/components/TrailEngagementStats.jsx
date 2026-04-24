import HikingIcon from "@mui/icons-material/Hiking";
import { Stack, Typography } from "@mui/material";
import BookmarkPinewoodIcon from "./BookmarkPinewoodIcon.jsx";

export default function TrailEngagementStats({
  hikersCount,
  savesCount,
  variant = "caption",
  dense,
  lightOnDark,
}) {
  const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const iconSx = dense ? { fontSize: 17 } : { fontSize: 19 };
  const subtle = lightOnDark ? "rgba(255,255,255,0.9)" : undefined;
  return (
    <Stack direction="row" spacing={dense ? 1.2 : 1.8} alignItems="center" flexWrap="wrap" useFlexGap>
      <Stack direction="row" spacing={0.35} alignItems="center">
        <HikingIcon
          sx={{ ...iconSx, color: subtle ?? "text.secondary", opacity: lightOnDark ? 1 : 0.9 }}
        />
        <Typography
          variant={variant}
          color={lightOnDark ? undefined : "text.secondary"}
          sx={{ fontWeight: 600, color: subtle }}
        >
          {n(hikersCount)}
        </Typography>
      </Stack>
      <Stack direction="row" spacing={0.35} alignItems="center">
        <BookmarkPinewoodIcon
          filled={false}
          sx={{
            ...iconSx,
            width: "1em",
            height: "1em",
            color: subtle ?? "text.secondary",
            opacity: lightOnDark ? 1 : 0.9,
          }}
        />
        <Typography
          variant={variant}
          color={lightOnDark ? undefined : "text.secondary"}
          sx={{ fontWeight: 600, color: subtle }}
        >
          {n(savesCount)}
        </Typography>
      </Stack>
    </Stack>
  );
}
