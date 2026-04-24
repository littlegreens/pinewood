import { createTheme } from "@mui/material/styles";

const palette = {
  pineGreen: "#2D4F1E",
  orangeDark: "#B35A1F",
  slateGray: "#6E6E6E",
  black: "#111111",
  white: "#FFFFFF",
};

export const appTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: palette.pineGreen,
      contrastText: palette.white,
    },
    secondary: {
      main: palette.orangeDark,
      contrastText: palette.white,
    },
    background: {
      default: palette.white,
      paper: palette.white,
    },
    text: {
      primary: palette.black,
      secondary: palette.slateGray,
    },
  },
  shape: {
    borderRadius: 14,
  },
  typography: {
    fontFamily: '"Titillium Web", "Segoe UI", system-ui, sans-serif',
    button: {
      textTransform: "none",
      fontWeight: 700,
      letterSpacing: 0.2,
    },
  },
});
