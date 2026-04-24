import StarRoundedIcon from "@mui/icons-material/StarRounded";
import StarBorderRoundedIcon from "@mui/icons-material/StarBorderRounded";

/** Stellina gialla: vuota quando non salvato, piena quando salvato. */
export default function BookmarkPinewoodIcon({ filled = false, sx, fontSize = "inherit", ...rest }) {
  if (filled) {
    return <StarRoundedIcon sx={{ fontSize, color: "#E2B93B", ...sx }} {...rest} />;
  }
  return <StarBorderRoundedIcon sx={{ fontSize, color: "#E2B93B", ...sx }} {...rest} />;
}
